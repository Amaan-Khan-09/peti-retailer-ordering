from typing import Literal

from pydantic import BaseModel, Field

Phone = Field(pattern=r"^[6-9]\d{9}$", description="10-digit Indian mobile number")


class OtpRequest(BaseModel):
    phone: str = Phone


class VerifyRequest(BaseModel):
    phone: str = Phone
    code: str = Field(pattern=r"^\d{6}$")


class CartLine(BaseModel):
    sku_id: int
    qty: int = Field(gt=0, le=10000)
    unit: Literal["CASE", "PIECE"]


class QuoteRequest(BaseModel):
    lines: list[CartLine] = Field(min_length=1, max_length=100)
    retailer_id: int | None = None  # desk only


class PlaceOrderRequest(BaseModel):
    lines: list[CartLine] = Field(min_length=1, max_length=100)
    note: str | None = Field(default=None, max_length=300)
    retailer_id: int | None = None  # salesman only: the shop being visited
    client_ref: str | None = Field(default=None, pattern=r"^[A-Za-z0-9-]{8,40}$")  # one per cart submission


class MessageText(BaseModel):
    text: str = Field(min_length=2, max_length=2000)


class NewMessage(BaseModel):
    retailer_id: int
    text: str = Field(min_length=2, max_length=2000)


class LineDecision(BaseModel):
    line_id: int
    sku_id: int | None = None
    qty: int | None = Field(default=None, gt=0, le=10000)
    unit: Literal["CASE", "PIECE"] | None = None
    removed: bool = False


class ConfirmCapture(BaseModel):
    lines: list[LineDecision] = Field(min_length=1, max_length=100)


class ExportRequest(BaseModel):
    order_ids: list[int] | None = None  # default: every confirmed order not yet exported
    format: Literal["xml", "csv"] = "xml"
