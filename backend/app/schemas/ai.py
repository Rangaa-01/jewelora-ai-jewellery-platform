from __future__ import annotations

from decimal import Decimal

from pydantic import Field

from app.schemas.catalogue import ProductSummaryOut
from app.schemas.common import APIModel


class StylistQueryIn(APIModel):
    query: str = Field(min_length=3, max_length=600)
    budget_max: Decimal | None = Field(default=None, ge=0)
    occasion: str | None = Field(default=None, max_length=40)
    limit: int = Field(default=6, ge=1, le=12)


class StylistConstraintsOut(APIModel):
    budget_max: Decimal | None
    budget_min: Decimal | None
    occasions: list[str]
    jewellery_types: list[str]
    metal_types: list[str]
    stone_types: list[str]
    styles: list[str]
    gender: str | None
    keywords: list[str]


class StylistRecommendationOut(APIModel):
    product: ProductSummaryOut
    reason: str
    score: float


class StylistResponseOut(APIModel):
    query: str
    constraints: StylistConstraintsOut
    recommendations: list[StylistRecommendationOut]
    note: str | None = None
    llm_used: bool


class VisualMatchOut(APIModel):
    product: ProductSummaryOut
    score: float


class VisualSearchOut(APIModel):
    exact: VisualMatchOut | None
    similar: list[VisualMatchOut]
    indexed_products: int
