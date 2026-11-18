from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select

from . import models as m, schemas as s
from .db import get_db
from .security import admin, fail
from .services import apply_patch, audit, page, serialize

router = APIRouter(prefix="/platform", tags=["Platform administration"],
                   dependencies=[Depends(admin)])


@router.get("/overview")
def overview(db=Depends(get_db)):
    def count(model, *conditions):
        return db.scalar(select(func.count()).select_from(model).where(*conditions))
    return {"total_tenants": count(m.Restaurant),
            "active_tenants": count(m.Restaurant, m.Restaurant.status == "active"),
            "suspended_tenants": count(m.Restaurant, m.Restaurant.status == "suspended"),
            "published_restaurants": count(m.Restaurant, m.Restaurant.published.is_(True),
                                           m.Restaurant.status == "active"),
            "total_orders": count(m.Order)}


@router.get("/tenants")
def tenants(page_number: int = Query(1, alias="page", ge=1),
            page_size: int = Query(20, ge=1, le=100), q: str = "", db=Depends(get_db)):
    query = select(m.Restaurant)
    if q:
        term = "%" + q[:100].replace("%", r"\%").replace("_", r"\_") + "%"
        query = query.where(m.Restaurant.name.ilike(term, escape="\\"))
    return page(db, query.order_by(m.Restaurant.name), page_number, page_size)


def tenant_lock(db, tenant_id):
    restaurant = db.scalar(select(m.Restaurant).where(m.Restaurant.id == tenant_id).with_for_update())
    if not restaurant:
        fail(404, "Restaurant not found.")
    return restaurant


@router.patch("/tenants/{tenant_id}/status")
def tenant_status(tenant_id: str, data: s.PlatformStatus, user=Depends(admin), db=Depends(get_db)):
    restaurant = tenant_lock(db, tenant_id)
    old = restaurant.status
    restaurant.status = data.status
    audit(db, user, "platform.tenant_status", restaurant.id, data.reason,
          {"from": old, "to": data.status})
    db.commit()
    return serialize(restaurant)


@router.patch("/tenants/{tenant_id}/plan")
def tenant_plan(tenant_id: str, data: s.PlanAssignment, user=Depends(admin), db=Depends(get_db)):
    plan = db.scalar(select(m.Plan).where(m.Plan.id == data.plan_id).with_for_update())
    if not plan or not plan.active:
        fail(422, "Select an active plan.")
    restaurant = tenant_lock(db, tenant_id)
    count = db.scalar(select(func.count()).select_from(m.MenuItem).where(
        m.MenuItem.restaurant_id == restaurant.id))
    if count > plan.max_menu_items:
        fail(409, "Existing menu exceeds the target plan cap.")
    old = restaurant.plan_id
    restaurant.plan_id = plan.id
    audit(db, user, "platform.tenant_plan", restaurant.id, data.reason,
          {"from": old, "to": plan.id})
    db.commit()
    return serialize(restaurant)


@router.get("/plans")
def plans(db=Depends(get_db)):
    return {"items": [serialize(plan) for plan in db.scalars(select(m.Plan).order_by(m.Plan.name))]}


@router.post("/plans", status_code=201)
def create_plan(data: s.PlanCreate, user=Depends(admin), db=Depends(get_db)):
    plan = m.Plan(**data.model_dump())
    db.add(plan)
    db.flush()
    audit(db, user, "platform.plan_created", details={"plan_id": plan.id})
    db.commit()
    return serialize(plan)


@router.patch("/plans/{plan_id}")
def update_plan(plan_id: str, data: s.PlanPatch, user=Depends(admin), db=Depends(get_db)):
    plan = db.scalar(select(m.Plan).where(m.Plan.id == plan_id).with_for_update())
    if not plan:
        fail(404, "Plan not found.")
    if data.max_menu_items is not None and data.max_menu_items < plan.max_menu_items:
        restaurants = db.scalars(select(m.Restaurant).where(
            m.Restaurant.plan_id == plan.id).with_for_update())
        for restaurant in restaurants:
            count = db.scalar(select(func.count()).select_from(m.MenuItem).where(
                m.MenuItem.restaurant_id == restaurant.id))
            if count > data.max_menu_items:
                fail(409, "Plan cap cannot be reduced below an assigned tenant's existing menu count.")
    apply_patch(plan, data)
    audit(db, user, "platform.plan_updated", details={"plan_id": plan.id,
                                                     "fields": sorted(data.model_fields_set)})
    db.commit()
    return serialize(plan)
