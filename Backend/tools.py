import os, requests, yfinance as yf
from bs4 import BeautifulSoup
from tavily import TavilyClient
from langchain_core.tools import tool

tavily = TavilyClient(api_key=os.getenv("TAVILY_API_KEY"))

@tool
def web_search(query: str) -> str:
    """Search the web for current info about a company: business model,
    products, news, leadership, competitors, funding, financials."""
    res = tavily.search(query, max_results=3)
    return "\n\n".join(
        f"{r['title']} ({r['url']})\n{r['content'][:300]}" for r in res["results"]
    )
    
@tool
def read_webpage(url: str) -> str:
    """Fetch a web page (e.g. a company's About page) and return its readable text."""
    try:
        r = requests.get(url, timeout=10, headers={"User-Agent": "Mozilla/5.0"})
        soup = BeautifulSoup(r.text, "html.parser")
        for t in soup(["script", "style", "nav", "footer"]):
            t.decompose()
        return soup.get_text(" ", strip=True)[:1500]   # truncate!
    except Exception as e:
        return f"Error fetching page: {e}"

@tool
def get_stock_data(ticker: str) -> str:
    """Get market data for a PUBLIC company by stock ticker (e.g. NVDA, MSFT):
    market cap, price, P/E, revenue, employees, sector."""
    try:
        info = yf.Ticker(ticker).info
        keys = ["longName", "sector", "industry", "marketCap", "currentPrice",
                "trailingPE", "totalRevenue", "profitMargins",
                "fullTimeEmployees", "fiftyTwoWeekHigh", "fiftyTwoWeekLow"]
        return "\n".join(f"{k}: {info.get(k)}" for k in keys)
    except Exception as e:
        return f"Error: {e}"

TOOLS = [web_search, read_webpage, get_stock_data]