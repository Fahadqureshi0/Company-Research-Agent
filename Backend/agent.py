import re
from datetime import date

from langchain.agents import create_agent
from langchain_groq import ChatGroq
from langgraph.errors import GraphRecursionError

from schemas import CompanyReport
from tools import TOOLS

MODEL = "openai/gpt-oss-120b"

# Model for the research agent (tool calling)
llm = ChatGroq(model=MODEL, temperature=0, max_tokens=1500, max_retries=2, timeout=60)

# Separate model object for turning notes into the structured report
structure_llm = ChatGroq(model=MODEL, temperature=0, max_tokens=3000, max_retries=2, timeout=60)

SYSTEM = """You are a company research analyst.
Use your tools to gather: what the company does, products/services, business model,
leadership, competitors, recent news, market cap and key financials, risks.

Rules:
- Make at most 5 tool calls in total, then stop and write your notes.
- The user message gives today's date. Put the current year in your search queries
  so results are recent.
- Prefer information from the last 12 months. If the newest data you find is older,
  say so and give its date. Never present old results as current.
- Use get_stock_data once for public companies, and take market cap, price, P/E and
  revenue from it. Say which figures came from it.
- Prefer web_search over read_webpage. Read at most 1 page.
- Only cite URLs that appeared in tool results. Never write placeholder or guessed URLs.
- Never invent numbers; if you can't find something, say so.
When done, write detailed research notes including source URLs."""

agent = create_agent(llm, tools=TOOLS, system_prompt=SYSTEM)


def describe_call(call: dict):
    """Turn a tool call into a (kind, text) activity event."""
    name = call.get("name", "")
    args = call.get("args", {}) or {}
    if name == "web_search":
        return "search", f'Searching the web: "{args.get("query", "")}"'
    if name == "read_webpage":
        return "read", f'Reading page: {args.get("url", "")}'
    if name == "get_stock_data":
        return "stock", f'Pulling market data for {args.get("ticker", "")}'
    return "info", f"Using tool: {name}"


def research(company: str, emit=None, should_stop=None) -> str:
    """Run the agent. emit(kind, text) is called for every real step."""
    emit = emit or (lambda kind, text: None)
    today = date.today().strftime("%d %B %Y")

    last_state = None
    seen = 0
    try:
        for state in agent.stream(
            {
                "messages": [
                    {
                        "role": "user",
                        "content": f"Today's date is {today}. Research the company: {company}",
                    }
                ]
            },
            config={"recursion_limit": 40},
            stream_mode="values",
        ):
            last_state = state
            messages = state["messages"]
            for m in messages[seen:]:
                kind = type(m).__name__
                if kind == "AIMessage":
                    calls = getattr(m, "tool_calls", None) or []
                    for call in calls:
                        emit(*describe_call(call))
                    if not calls and str(m.content).strip():
                        emit("write", "Writing the research notes")
                elif kind == "ToolMessage":
                    text = str(m.content)
                    if text.startswith("Error"):
                        emit("error", f"{m.name} failed: {text[:120]}")
                    else:
                        emit("result", f"Received results from {m.name}")
            seen = len(messages)

            if should_stop and should_stop():
                raise RuntimeError("Cancelled")
    except GraphRecursionError:
        raise RuntimeError("The agent took too many steps. Try again.")

    if last_state is None:
        raise RuntimeError("The agent returned nothing.")

    notes = last_state["messages"][-1].content

    # Collect URLs that really appeared in tool results, so sources can't be invented
    urls = []
    for m in last_state["messages"]:
        if type(m).__name__ == "ToolMessage":
            urls += re.findall(r"https?://[^\s)\]>\"']+", str(m.content))
    urls = list(dict.fromkeys(urls))[:15]

    return f"{notes}\n\nVERIFIED SOURCE URLS:\n" + "\n".join(urls)


def to_structured(notes: str) -> CompanyReport:
    structured = structure_llm.with_structured_output(CompanyReport)
    report = structured.invoke(
        "Convert these research notes into the schema. Use only facts in the notes. "
        "Every list item must be a plain text string, never an object or dictionary. "
        "Keep dates with news and financial figures.\n\n"
        f"{notes}"
    )
    # Safety net: keep only sources that were really returned by the tools
    verified = notes.split("VERIFIED SOURCE URLS:")[-1]
    report.sources = [u for u in report.sources if u in verified]
    return report