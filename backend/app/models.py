from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import JSON, Boolean, Date, DateTime, Float, ForeignKey, Integer, LargeBinary, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base, utcnow


class Retailer(Base):
    __tablename__ = "retailers"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    shop_name: Mapped[str] = mapped_column(String(120))
    owner_name: Mapped[str] = mapped_column(String(120))
    area: Mapped[str] = mapped_column(String(80))
    phone: Mapped[str] = mapped_column(String(15))
    credit_limit: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    # Outstanding comes from Tally (out of scope); open orders not yet exported are added on top.
    outstanding: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    salesman_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", use_alter=True))  # the shop's beat


class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(15), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(20))  # retailer | salesman | desk
    retailer_id: Mapped[int | None] = mapped_column(ForeignKey("retailers.id"))
    retailer: Mapped[Retailer | None] = relationship(foreign_keys=[retailer_id])


class OtpCode(Base):
    __tablename__ = "otp_codes"
    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(15), index=True)
    code_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    used: Mapped[bool] = mapped_column(Boolean, default=False)


class Brand(Base):
    __tablename__ = "brands"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(60))


class Sku(Base):
    __tablename__ = "skus"
    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    name_hi: Mapped[str] = mapped_column(String(120), default="")
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"))
    category: Mapped[str] = mapped_column(String(40))
    line: Mapped[str] = mapped_column(String(60))  # product line without the size, e.g. "Glucose biscuit"
    pack_label: Mapped[str] = mapped_column(String(20))
    size_value: Mapped[float] = mapped_column(Float)  # grams or millilitres
    units_per_case: Mapped[int] = mapped_column(Integer)
    dealer_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))  # per piece, excluding GST
    gst_rate: Mapped[Decimal] = mapped_column(Numeric(5, 2))
    mrp: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)  # printed retail price per piece, GST included
    stock_cases: Mapped[int] = mapped_column(Integer)
    keywords: Mapped[str] = mapped_column(String(200), default="")
    brand: Mapped[Brand] = relationship()
    schemes: Mapped[list["Scheme"]] = relationship(back_populates="sku")


class RetailerPrice(Base):
    __tablename__ = "retailer_prices"
    __table_args__ = (UniqueConstraint("retailer_id", "sku_id"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    retailer_id: Mapped[int] = mapped_column(ForeignKey("retailers.id"))
    sku_id: Mapped[int] = mapped_column(ForeignKey("skus.id"))
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))


class Scheme(Base):
    __tablename__ = "schemes"
    id: Mapped[int] = mapped_column(primary_key=True)
    sku_id: Mapped[int] = mapped_column(ForeignKey("skus.id"))
    kind: Mapped[str] = mapped_column(String(20))  # FREE_GOODS | SLAB_DISCOUNT
    label: Mapped[str] = mapped_column(String(80))
    buy_qty: Mapped[int | None] = mapped_column(Integer)
    free_qty: Mapped[int | None] = mapped_column(Integer)
    min_cases: Mapped[int | None] = mapped_column(Integer)
    discount_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2))
    valid_from: Mapped[date] = mapped_column(Date)
    valid_to: Mapped[date] = mapped_column(Date)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    sku: Mapped[Sku] = relationship(back_populates="schemes")


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (UniqueConstraint("retailer_id", "client_ref"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    number: Mapped[str] = mapped_column(String(20), unique=True)
    retailer_id: Mapped[int] = mapped_column(ForeignKey("retailers.id"), index=True)
    source: Mapped[str] = mapped_column(String(20))  # app | ai_capture | salesman | desk_entry (typed by the office)
    # One key per cart submission: a retry on a flaky network returns the same order instead of a second one.
    client_ref: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20), index=True)  # PLACED | CREDIT_HOLD | CONFIRMED | EXPORTED | CANCELLED
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    discount_total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    gst_total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    free_cases_total: Mapped[int] = mapped_column(Integer, default=0)
    hold_reason: Mapped[str | None] = mapped_column(Text)
    note: Mapped[str | None] = mapped_column(Text)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime)
    exported_at: Mapped[datetime | None] = mapped_column(DateTime)
    retailer: Mapped[Retailer] = relationship()
    lines: Mapped[list["OrderLine"]] = relationship(back_populates="order", cascade="all, delete-orphan")
    messages: Mapped[list["OutboundMessage"]] = relationship(viewonly=True)


class OrderLine(Base):
    __tablename__ = "order_lines"
    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id"), index=True)
    sku_id: Mapped[int] = mapped_column(ForeignKey("skus.id"))
    unit: Mapped[str] = mapped_column(String(10))  # CASE | PIECE
    qty: Mapped[int] = mapped_column(Integer)
    reserved_cases: Mapped[int] = mapped_column(Integer, default=0)
    free_cases: Mapped[int] = mapped_column(Integer, default=0)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    gross: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    discount: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    gst: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    scheme_note: Mapped[str | None] = mapped_column(String(160))
    order: Mapped[Order] = relationship(back_populates="lines")
    sku: Mapped[Sku] = relationship()


class InboundMessage(Base):
    __tablename__ = "inbound_messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    retailer_id: Mapped[int] = mapped_column(ForeignKey("retailers.id"))
    channel: Mapped[str] = mapped_column(String(20), default="whatsapp")
    text: Mapped[str] = mapped_column(Text)  # for voice notes and photos: the transcript
    kind: Mapped[str] = mapped_column(String(10), default="text")  # text | voice | photo
    media_type: Mapped[str | None] = mapped_column(String(40))
    media: Mapped[bytes | None] = mapped_column(LargeBinary, deferred=True)
    transcript_engine: Mapped[str | None] = mapped_column(String(80))
    received_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    status: Mapped[str] = mapped_column(String(20), default="NEW")  # NEW | NEEDS_TEXT | CAPTURED | ORDERED | DISMISSED
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"))
    retailer: Mapped[Retailer] = relationship()


class Capture(Base):
    __tablename__ = "captures"
    id: Mapped[int] = mapped_column(primary_key=True)
    message_id: Mapped[int] = mapped_column(ForeignKey("inbound_messages.id"), index=True)
    retailer_id: Mapped[int] = mapped_column(ForeignKey("retailers.id"))
    engine: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20), default="DRAFT")  # DRAFT | CONFIRMED
    warnings: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    confirmed_at: Mapped[datetime | None] = mapped_column(DateTime)
    message: Mapped[InboundMessage] = relationship()
    lines: Mapped[list["CaptureLine"]] = relationship(back_populates="capture", cascade="all, delete-orphan",
                                                      order_by="CaptureLine.position")


class CaptureLine(Base):
    __tablename__ = "capture_lines"
    id: Mapped[int] = mapped_column(primary_key=True)
    capture_id: Mapped[int] = mapped_column(ForeignKey("captures.id"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    raw_text: Mapped[str] = mapped_column(String(300))
    phrase: Mapped[str] = mapped_column(String(160))  # normalised item words, the alias key
    qty: Mapped[int | None] = mapped_column(Integer)
    unit: Mapped[str | None] = mapped_column(String(10))
    size_hint: Mapped[str | None] = mapped_column(String(20))
    suggested_sku_id: Mapped[int | None] = mapped_column(ForeignKey("skus.id"))
    confidence: Mapped[float] = mapped_column(Float, default=0)
    level: Mapped[str] = mapped_column(String(10), default="LOW")  # HIGH | MEDIUM | LOW
    alternatives: Mapped[list] = mapped_column(JSON, default=list)
    reasons: Mapped[list] = mapped_column(JSON, default=list)
    # What the desk finally decided, kept to measure how often the AI needed correcting.
    final_sku_id: Mapped[int | None] = mapped_column(ForeignKey("skus.id"))
    final_qty: Mapped[int | None] = mapped_column(Integer)
    final_unit: Mapped[str | None] = mapped_column(String(10))
    removed: Mapped[bool] = mapped_column(Boolean, default=False)
    corrected: Mapped[bool] = mapped_column(Boolean, default=False)
    capture: Mapped[Capture] = relationship(back_populates="lines")


class Alias(Base):
    """A desk correction remembered for one retailer: these words mean this SKU."""
    __tablename__ = "aliases"
    __table_args__ = (UniqueConstraint("retailer_id", "phrase"),)
    id: Mapped[int] = mapped_column(primary_key=True)
    retailer_id: Mapped[int] = mapped_column(ForeignKey("retailers.id"))
    phrase: Mapped[str] = mapped_column(String(160))
    sku_id: Mapped[int] = mapped_column(ForeignKey("skus.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AuditEvent(Base):
    __tablename__ = "audit_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    action: Mapped[str] = mapped_column(String(60))
    detail: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class OutboundMessage(Base):
    """WhatsApp updates to the shop. Sending is mocked: messages are stored and shown, not delivered."""
    __tablename__ = "outbound_messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    retailer_id: Mapped[int] = mapped_column(ForeignKey("retailers.id"))
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"), index=True)
    text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
