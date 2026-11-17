import re
from datetime import datetime
from decimal import Decimal
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

Money = Annotated[Decimal, Field(ge=0, le=10000000, max_digits=12, decimal_places=2)]
Name = Annotated[str, Field(min_length=1, max_length=160)]
PersonName = Annotated[str, Field(min_length=1, max_length=150)]
CategoryName = Annotated[str, Field(min_length=1, max_length=120)]
TableName = Annotated[str, Field(min_length=1, max_length=100)]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Login(Input):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class Register(Login):
    full_name: PersonName
    restaurant_name: Name
    slug: str = Field(pattern=r"^[a-z0-9]+(?:-[a-z0-9]+)*$", min_length=3, max_length=80)
    password: str = Field(min_length=12, max_length=200)


class Verify(Input):
    token: str = Field(min_length=20, max_length=200)


class ResendVerification(Input):
    email: EmailStr


class Hours(Input):
    open: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    close: str = Field(pattern=r"^(?:[01]\d|2[0-3]):[0-5]\d$")
    closed: bool

    @model_validator(mode="after")
    def interval(self):
        if not self.closed and self.close <= self.open:
            raise ValueError("Closing time must be after opening time; split overnight hours.")
        return self


class GalleryImage(Input):
    image_url: str = Field(min_length=1, max_length=2000)
    alt: str = Field(min_length=1, max_length=200)

    @field_validator("image_url")
    @classmethod
    def safe_image(cls, value):
        if not value.startswith(("/food/", "/media/", "https://")):
            raise ValueError("Use /food/, /media/, or HTTPS image URLs.")
        return value


class FAQ(Input):
    question: str = Field(min_length=1, max_length=200)
    answer: str = Field(min_length=1, max_length=3000)


class WebsiteSettings(Input):
    about_text: str = Field(default="", max_length=10000)
    seo_title: str = Field(default="", max_length=160)
    seo_description: str = Field(default="", max_length=320)
    theme: Literal["navy", "emerald", "terracotta"] = "navy"
    typography: Literal["editorial", "sans"] = "editorial"
    reservations_enabled: bool = True
    gallery_enabled: bool = False
    faqs_enabled: bool = False
    gallery: list[GalleryImage] = Field(default_factory=list, max_length=30)
    faqs: list[FAQ] = Field(default_factory=list, max_length=30)
    cancellation_policy: str = Field(default="", max_length=10000)
    homepage_sections: list[Literal["featured", "about", "gallery", "hours"]] = Field(
        default_factory=lambda: ["featured", "about", "hours"], max_length=4)

    @field_validator("homepage_sections")
    @classmethod
    def unique_sections(cls, value):
        if len(set(value)) != len(value):
            raise ValueError("Homepage sections must be unique.")
        return value


class InquiryInput(Input):
    customer_name: PersonName
    email: EmailStr = Field(max_length=254)
    subject: str = Field(min_length=1, max_length=160)
    message: str = Field(min_length=10, max_length=5000)
    consent: Literal[True]

    @field_validator("subject")
    @classmethod
    def single_line_subject(cls, value):
        if "\r" in value or "\n" in value:
            raise ValueError("Subject must be a single line.")
        return value


class InquiryStatus(Input):
    status: Literal["new", "read", "resolved"]


class RestaurantPatch(Input):
    name: Name | None = None
    tagline: str | None = Field(default=None, max_length=250)
    description: str | None = Field(default=None, max_length=5000)
    cuisine: str | None = Field(default=None, max_length=100)
    city: str | None = Field(default=None, max_length=100)
    address: str | None = Field(default=None, max_length=1000)
    phone: str | None = Field(default=None, max_length=50)
    email: EmailStr | None = None
    logo_url: str | None = Field(default=None, max_length=2000)
    hero_image_url: str | None = Field(default=None, max_length=2000)
    published: bool | None = None
    allow_pickup: bool | None = None
    allow_delivery: bool | None = None
    delivery_fee: Money | None = None
    minimum_order: Money | None = None
    tax_rate: Annotated[Decimal, Field(ge=0, le=100, decimal_places=2)] | None = None
    tax_inclusive: bool | None = None
    opening_hours: dict[str, Hours] | None = None
    reservation_duration_minutes: int | None = Field(default=None, ge=15, le=360)
    reservation_buffer_minutes: int | None = Field(default=None, ge=0, le=180)
    reservation_days_ahead: int | None = Field(default=None, ge=1, le=180)
    website_settings: WebsiteSettings | None = None

    @field_validator("opening_hours")
    @classmethod
    def seven_days(cls, value):
        if value is not None and set(value) != {"mon", "tue", "wed", "thu", "fri", "sat", "sun"}:
            raise ValueError("Exactly seven weekday keys are required.")
        return value

    @field_validator("logo_url", "hero_image_url")
    @classmethod
    def safe_image(cls, value):
        if value and not (value.startswith(("/food/", "/media/", "https://"))):
            raise ValueError("Use /food/, /media/, or HTTPS image URLs.")
        return value

    @model_validator(mode="after")
    def no_null(self):
        if any(getattr(self, field) is None for field in self.model_fields_set):
            raise ValueError("Fields cannot be null.")
        return self


class CategoryCreate(Input):
    name: CategoryName
    position: int = Field(default=0, ge=0, le=10000)
    published: bool = False


class CategoryPatch(Input):
    name: CategoryName | None = None
    position: int | None = Field(default=None, ge=0, le=10000)
    published: bool | None = None


class Option(Input):
    id: str | None = Field(default=None, min_length=1, max_length=100)
    name: Name
    price_delta: Money = Decimal("0.00")


class ItemCreate(Input):
    category_id: str
    name: Name
    description: str = Field(default="", max_length=3000)
    image_url: str = Field(default="", max_length=2000)
    price: Money
    available: bool = True
    published: bool = False
    featured: bool = False
    variant_required: bool = False
    variants: list[Option] = Field(default_factory=list, max_length=30)
    modifiers: list[Option] = Field(default_factory=list, max_length=30)

    @field_validator("image_url")
    @classmethod
    def safe_image(cls, value):
        return RestaurantPatch.safe_image(value)


class ItemPatch(Input):
    category_id: str | None = None
    name: Name | None = None
    description: str | None = Field(default=None, max_length=3000)
    image_url: str | None = Field(default=None, max_length=2000)
    price: Money | None = None
    available: bool | None = None
    published: bool | None = None
    featured: bool | None = None
    variant_required: bool | None = None
    variants: list[Option] | None = Field(default=None, max_length=30)
    modifiers: list[Option] | None = Field(default=None, max_length=30)

    @field_validator("image_url")
    @classmethod
    def safe_image(cls, value):
        return RestaurantPatch.safe_image(value)


class CartLine(Input):
    menu_item_id: str
    quantity: int = Field(ge=1, le=50)
    variant_id: str | None = None
    modifier_ids: list[str] = Field(default_factory=list, max_length=30)
    notes: str = Field(default="", max_length=500)

    @field_validator("modifier_ids")
    @classmethod
    def unique(cls, value):
        if len(set(value)) != len(value):
            raise ValueError("Duplicate modifier selection.")
        return sorted(value)


class QuoteInput(Input):
    items: list[CartLine] = Field(min_length=1, max_length=50)
    fulfilment: Literal["pickup", "delivery"]


class OrderInput(QuoteInput):
    quote_token: str = Field(min_length=20, max_length=20000)
    customer_name: PersonName
    email: EmailStr | Literal[""] = ""
    phone: str = Field(min_length=7, max_length=50)
    address: str = Field(default="", max_length=1000)
    notes: str = Field(default="", max_length=1000)
    consent: Literal[True]

    @model_validator(mode="after")
    def delivery_address(self):
        if self.fulfilment == "delivery" and len(self.address) < 5:
            raise ValueError("Delivery address is required.")
        return self


class ReservationInput(Input):
    starts_at: datetime
    party_size: int = Field(ge=1, le=30)
    customer_name: PersonName
    email: EmailStr | Literal[""] = ""
    phone: str = Field(min_length=7, max_length=50)
    notes: str = Field(default="", max_length=1000)
    consent: Literal[True]

    @field_validator("starts_at")
    @classmethod
    def aware(cls, value):
        if value.tzinfo is None:
            raise ValueError("Timestamp must include UTC offset.")
        return value


class StatusInput(Input):
    status: str = Field(min_length=1, max_length=30)
    reason: str = Field(default="", max_length=1000)


class PlatformStatus(Input):
    status: Literal["active", "suspended"]
    reason: str = Field(min_length=5, max_length=1000)


class PlanAssignment(Input):
    plan_id: str
    reason: str = Field(min_length=5, max_length=1000)


class TableCreate(Input):
    name: TableName
    capacity: int = Field(ge=1, le=30)
    active: bool = True


class TablePatch(Input):
    name: TableName | None = None
    capacity: int | None = Field(default=None, ge=1, le=30)
    active: bool | None = None


class PlanCreate(Input):
    name: CategoryName
    description: str = Field(default="", max_length=2000)
    max_menu_items: int = Field(ge=1, le=10000)
    active: bool = True


class PlanPatch(Input):
    name: CategoryName | None = None
    description: str | None = Field(default=None, max_length=2000)
    max_menu_items: int | None = Field(default=None, ge=1, le=10000)
    active: bool | None = None
