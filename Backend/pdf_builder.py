from datetime import date
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    HRFlowable,
    ListFlowable,
    ListItem,
    Paragraph,
    SimpleDocTemplate,
    Spacer,
    Table,
    TableStyle,
)

NAVY = colors.HexColor("#14213D")
ACCENT = colors.HexColor("#0B6E6E")
GREY = colors.HexColor("#5D6B7C")
INK = colors.HexColor("#1B2430")
LINE = colors.HexColor("#D5DCE5")

# The built-in PDF fonts can't draw many symbols the LLM likes to write
# (non-breaking hyphen, approx sign, arrows...). They show up as black squares.
REPLACEMENTS = {
    "\u2010": "-",
    "\u2011": "-",  # non-breaking hyphen (the main cause of the squares)
    "\u2012": "-",
    "\u2212": "-",
    "\u00a0": " ",
    "\u202f": " ",
    "\u2009": " ",
    "\u200a": " ",
    "\u200b": "",
    "\u2248": "~",
    "\u2265": ">=",
    "\u2264": "<=",
    "\u2192": "->",
    "\u2713": "",
}


def normalize(text) -> str:
    text = str(text)
    for old, new in REPLACEMENTS.items():
        text = text.replace(old, new)
    # drop anything the built-in font still can't draw
    return text.encode("cp1252", "ignore").decode("cp1252").strip()


def clean(text) -> str:
    return escape(normalize(text))


def build_pdf(report, path: str):
    ss = getSampleStyleSheet()
    body = ParagraphStyle(
        "body", parent=ss["BodyText"], fontName="Helvetica", fontSize=10,
        leading=14.5, textColor=INK, spaceAfter=4,
    )
    h2 = ParagraphStyle(
        "h2", parent=ss["Heading2"], fontName="Helvetica-Bold", fontSize=13,
        textColor=ACCENT, spaceBefore=14, spaceAfter=2, keepWithNext=1,
    )
    title = ParagraphStyle(
        "title", parent=ss["Title"], fontName="Helvetica-Bold", fontSize=22,
        leading=26, textColor=colors.white, alignment=0, spaceAfter=0,
    )
    subtitle = ParagraphStyle(
        "subtitle", parent=body, fontSize=10, textColor=colors.HexColor("#C9D3E0"),
        spaceAfter=0,
    )
    label = ParagraphStyle("label", parent=body, fontName="Helvetica-Bold", fontSize=9.5)
    link = ParagraphStyle(
        "link", parent=body, fontSize=9, leading=12, wordWrap="CJK", spaceAfter=2,
    )
    note = ParagraphStyle("note", parent=body, fontSize=8.5, textColor=GREY)

    doc = SimpleDocTemplate(
        path, pagesize=A4,
        leftMargin=20 * mm, rightMargin=20 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title=normalize(f"{report.name} - Company report"),
        author="Company Research Agent",
    )

    story = []

    # Title band
    band = Table(
        [
            [Paragraph(clean(report.name), title)],
            [Paragraph("Company research report", subtitle)],
        ],
        colWidths=[doc.width],
    )
    band.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), NAVY),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (0, 0), 14),
        ("BOTTOMPADDING", (0, -1), (-1, -1), 14),
    ]))
    story += [band, Spacer(1, 6)]
    story.append(Paragraph(
        f"Generated {date.today().strftime('%d %B %Y')}. Compiled from public web "
        "sources by an AI agent. Check important figures against the sources below.",
        note,
    ))

    def section(heading, flowables):
        story.append(Paragraph(heading, h2))
        story.append(HRFlowable(width="100%", thickness=0.6, color=LINE, spaceAfter=6))
        story.extend(flowables)

    def bullets(items):
        items = [i for i in items if str(i).strip()]
        return [ListFlowable(
            [ListItem(Paragraph(clean(i), body), leftIndent=12) for i in items],
            bulletType="bullet", start="\u2022", leftIndent=12, bulletFontSize=9,
        )]

    def facts_table(items):
        rows = []
        for item in items:
            text = normalize(item)
            if ":" in text:
                key, val = text.split(":", 1)
            else:
                key, val = "", text
            rows.append([Paragraph(clean(key), label), Paragraph(clean(val), body)])
        t = Table(rows, colWidths=[doc.width * 0.3, doc.width * 0.7])
        t.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LINEBELOW", (0, 0), (-1, -1), 0.4, LINE),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 2),
        ]))
        return [t]

    def source_links(urls):
        out = []
        for u in urls:
            u = normalize(u)
            if u.startswith("http"):
                href = escape(u, {'"': "&quot;"})
                out.append(Paragraph(
                    f'<link href="{href}" color="#0B6E6E">{escape(u)}</link>', link
                ))
            else:
                out.append(Paragraph(clean(u), link))
        return out

    section("Overview", [Paragraph(clean(report.overview), body)])
    section("Key financials", facts_table(report.financials))
    section("Products and services", bullets(report.products_services))
    section("Business model", [Paragraph(clean(report.business_model), body)])
    section("Leadership", bullets(report.leadership))
    section("Competitors", bullets(report.competitors))
    section("Recent news", bullets(report.recent_news))
    section("Risks", bullets(report.risks))
    if report.sources:
        section("Sources", source_links(report.sources))

    def footer(canvas, _doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(GREY)
        canvas.drawString(20 * mm, 10 * mm, normalize(f"{report.name} - Company report"))
        canvas.drawRightString(A4[0] - 20 * mm, 10 * mm, f"Page {_doc.page}")
        canvas.restoreState()

    doc.build(story, onFirstPage=footer, onLaterPages=footer)