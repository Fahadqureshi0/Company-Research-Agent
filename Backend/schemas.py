from typing import List

from pydantic import BaseModel, Field


class CompanyReport(BaseModel):
    name: str = Field(description="Official company name.")
    overview: str = Field(
        description="2 to 4 plain sentences: what the company does, where it is based, and its size."
    )
    products_services: List[str] = Field(
        description="At most 8 plain strings, 'Product: short description'. Only products that currently exist. Never objects."
    )
    business_model: str = Field(
        description="One short paragraph on how the company makes money."
    )
    leadership: List[str] = Field(
        description="At most 5 plain strings, 'Name: Role'. Only people named in the notes. Never objects."
    )
    competitors: List[str] = Field(
        description="At most 8 plain strings: the most direct competitors only."
    )
    financials: List[str] = Field(
        description=(
            "At most 8 plain strings, 'Metric: value (as of date or period)', for example "
            "'Market cap: $1.2 trillion (24 Oct 2026)'. Use only numbers from the notes. "
            "Skip a metric if the notes do not give it."
        )
    )
    recent_news: List[str] = Field(
        description="At most 5 plain strings, 'Date: what happened'. Newest first. Never objects."
    )
    risks: List[str] = Field(
        description="At most 5 plain strings, 'Risk: short explanation'. Never objects."
    )
    sources: List[str] = Field(
        description="Source URLs copied exactly from the VERIFIED SOURCE URLS list in the notes. Never invent, shorten or guess a URL."
    )