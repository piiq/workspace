from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from loguru import logger
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api import crud, schemas
from api.auth_helpers import check_pro
from api.database import aget_write_db
from api.models import User
from api.models.entity_models import PermissionsEntityMap
from api.models.user_models import UserProInvite
from routers.pro.index import process_create_user
from utilities.config import settings

router = APIRouter(prefix="/testing", tags=["testing"])


async def get_permissions_uuid(db: AsyncSession, as_admin: bool = False) -> UUID:
    permissions_uuid = settings.DEFAULT_PERMISSIONS_UUID
    if permissions_uuid is None:
        raise HTTPException(503, detail="Provision an organization before creating test accounts")
    if as_admin:
        entity_uuid = await crud.get_user_entity_uuid(db, permissions_uuid)
        permissions_uuid = await db.scalar(select(PermissionsEntityMap.uuid).where(
            PermissionsEntityMap.entity_uuid == entity_uuid,
            PermissionsEntityMap.name == "Admin",
        ))
    if permissions_uuid is None:
        raise HTTPException(500, detail="Organization has no Admin role")
    return permissions_uuid


@router.delete("/user/{email}", response_model=schemas.SuccessReturn)
async def delete_user(
    email: str,
    as_admin: bool = False,
    db: AsyncSession = Depends(aget_write_db),
    _=Depends(check_pro),
):
    "This should remove all traces of a user from the database"
    permissions_uuid = await get_permissions_uuid(db, as_admin)

    query = (
        select(User.uuid, User.email)
        .where(User.email == email, User.permissions_uuid == permissions_uuid)
        .limit(1)
    )
    result = await db.execute(query)
    user = result.mappings().first()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    logger.info(f"Deleting user {user.email} with uuid {user.uuid}")

    try:
        from api.marketing import MarketingService  # noqa: PLC0415

        MarketingService.delete_contact(user.email)
    except Exception as e:
        logger.error(f"Failed to delete marketing contact {user.email}: {e}")

    await crud.full_delete_user(db, user.uuid)
    return {"success": True}


@router.post("/user/{email}", response_model=schemas.SuccessReturn)
async def complete_user(
    email: str,
    password: str,
    as_admin: bool = False,
    db: AsyncSession = Depends(aget_write_db),
    _=Depends(check_pro),
):
    "This should mark a user as having completed signup"
    invite_query = (
        select(UserProInvite.uuid)
        .where(UserProInvite.email == email, UserProInvite.used.is_(False))
        .limit(1)
    )
    invite_uuid = (await db.execute(invite_query)).scalars().first()

    if invite_uuid and not (
        await process_create_user(invite_uuid, email, db, from_oauth=True)
    ):
        raise HTTPException(status_code=500, detail="Failed to create user from invite")

    permissions_uuid = await get_permissions_uuid(db, as_admin)

    query = (
        update(User)
        .where(User.email == email)
        .values(
            confirmed=True,
            permissions_uuid=permissions_uuid,
            password=password,
            temporary_password=False,
        )
    )

    result = await db.execute(query)
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="User not found")

    return {"success": True}
