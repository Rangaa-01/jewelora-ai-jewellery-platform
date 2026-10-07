from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, Field, computed_field


class APIModel(BaseModel):
    model_config = ConfigDict(
        from_attributes=True, populate_by_name=True, str_strip_whitespace=True
    )


class Page[T](APIModel):
    items: list[T]
    total: int
    page: int = Field(ge=1)
    page_size: int = Field(ge=1)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def pages(self) -> int:
        return max(1, -(-self.total // self.page_size))


class Message(APIModel):
    message: str


class IdResponse(APIModel):
    id: str


JSONDict = dict[str, Any]
