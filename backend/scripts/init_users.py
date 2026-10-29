import json
import os
import tomllib
from collections.abc import Callable, Coroutine
from contextlib import suppress
from pathlib import Path
from typing import Any
from uuid import UUID

from fastapi.encoders import jsonable_encoder
from loguru import logger
from pydantic import BaseModel, Field, SecretStr, field_validator
from sqlalchemy import insert, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from api import base, schemas
from api.base import clean_email
from api.models import Entity, EntityType, PermissionsEntityMap, User
from routers.entity import add_entity, aget_write_db
from routers.pro.index import process_create_user, register_pro_user

type MaybCoro[T] = Coroutine[Any, Any, T] | T


CONFIG_PATH = Path(__file__).parent / "cfgs"

BACKEND_DIR = Path(__file__).parent.parent
USER_CREATE_JSON_PATH = Path(
    os.environ.get("USER_CREATE_PATH", str(BACKEND_DIR / "user_create.json"))
)


class UserConfig(BaseModel):
    email: str
    first_name: str
    last_name: str


class AdminUser(UserConfig):
    password: SecretStr
    uuid: UUID | None = None


class EntityConfig(BaseModel):
    name: str
    aum: int
    company_type: str
    organization_size: str
    country: str


class Config(BaseModel):
    entity: EntityConfig
    admins: list[AdminUser] = Field(min_length=1)
    users: list[UserConfig] = Field(default_factory=list)

    @field_validator("users", "admins", mode="before", check_fields=False)
    @classmethod
    def check_users(cls, v):
        return [user for user in v if user.get("email")]


async def call_func[**P, T](
    func: Callable[P, MaybCoro[T]], *args: P.args, **kwargs: P.kwargs
) -> T:
    """Unwraps a function to ignore decorators."""

    while hasattr(func, "__wrapped__"):
        func = func.__wrapped__

    return await func(*args, **kwargs)


class SetupConfig:
    db: AsyncSession
    config: Config
    admin_user: User | None
    code: str

    def __init__(self, config: Config, db: AsyncSession):
        self.db = db
        self.config = config
        self.admin_user: User | None = None
        self.code = config.entity.name[:3].upper()

    async def add_entity(self, entity: schemas.EntityPost):
        return await call_func(add_entity, None, entity, self.db)

    async def create_user(self, the_uuid: UUID, email: str) -> User:
        return await process_create_user(the_uuid, email, self.db)

    async def init_admins(self, permissions_uuid: UUID) -> None:
        admin_users: list[User] = []
        for admin in self.config.admins:
            admin_users.append(await self.create_admin(admin, permissions_uuid))

        self.admin_user = admin_users[0]

    async def create_admin(self, admin_user: AdminUser, permissions_uuid: UUID) -> User:
        logger.info(f"Checking for admin: {admin_user.email}")
        query = select(User).where(User.email == admin_user.email)
        result = await self.db.execute(query)

        if (user := result.scalars().first()) is None:
            logger.info(f"Creating admin: {admin_user.email} with is_superuser=1")
            query = insert(User).values(
                email=admin_user.email,
                first_name=admin_user.first_name,
                last_name=admin_user.last_name,
                confirmed=1,
                clean_email=clean_email(admin_user.email),
                permissions_uuid=permissions_uuid,
                is_superuser=1,
                password=admin_user.password.get_secret_value(),
            )
            result = await self.db.execute(query)
            await self.db.commit()

            return await self.create_admin(admin_user, permissions_uuid)

        password_ok = False
        if user.password:
            with suppress(Exception):
                password_ok = base.verify_password(
                    admin_user.password.get_secret_value(), user.password
                )
        if not user.is_superuser or not password_ok or user.permissions_uuid != permissions_uuid:
            logger.info(
                f"Updating admin: {admin_user.email} (is_superuser={user.is_superuser})"
            )
            stmt = (
                update(User)
                .where(User.uuid == user.uuid)
                .values(
                    is_superuser=1,
                    permissions_uuid=permissions_uuid,
                    confirmed=1,
                    password=admin_user.password.get_secret_value(),
                )
            )
            await self.db.execute(stmt)
            await self.db.commit()
            await self.db.refresh(user)
            return await self.create_admin(admin_user, permissions_uuid)

        logger.info(
            f"Admin already exists: {admin_user.email}, is_superuser={user.is_superuser}"
        )
        return user

    async def create_entity(self):
        query = select(EntityType.uuid).where(EntityType.code == self.code)
        result = await self.db.execute(query)

        main_admin = self.config.admins[0]

        if (entity_type_uuid := result.scalars().first()) is None:
            query = insert(EntityType).values(
                entity_type="Workspace",
                code=self.code,
                active=True,
                permission_hierarchy=2,
            )

            result = await self.db.execute(query)
            await self.db.commit()
            entity_type_uuid = result.inserted_primary_key[0]

        return await self.add_entity(
            schemas.EntityPost(
                email=main_admin.email,
                admin_email=main_admin.email,
                entity_code=str(entity_type_uuid),
                **self.config.entity.model_dump(),
            ),
        )

    async def run(self, *, registration_default: bool = True):
        query = select(Entity.uuid).where(Entity.name == self.config.entity.name)
        result = await self.db.execute(query)

        if (entity_uuid := result.scalars().first()) is None:
            entity_data = await self.create_entity()
            entity_uuid = entity_data["entity_uuid"]

        query = select(PermissionsEntityMap).where(
            PermissionsEntityMap.entity_uuid == entity_uuid
        )
        result = await self.db.execute(query)

        permissions_map: dict[str, UUID] = {}

        for permission in result.scalars().all():
            permissions_map[permission.name] = permission.uuid

        await self.init_admins(permissions_map["Admin"])

        user_create = {
            "admin_permissions_uuid": permissions_map["Admin"],
            "permissions_uuid": permissions_map["User"],
            "inviting_uuid": self.admin_user.uuid,
            "inviting_email": self.admin_user.email,
        }
        if registration_default:
            with USER_CREATE_JSON_PATH.open("w", encoding="utf-8", newline="\n") as f:
                f.write(json.dumps(jsonable_encoder(user_create), indent=4))

        for user in self.config.users:
            existing_user = await self.db.scalar(select(User).where(User.email == user.email))
            if existing_user:
                if existing_user.permissions_uuid != permissions_map["User"]:
                    raise RuntimeError(f"Account {user.email} belongs to a different organization or role")
                continue
            user_create = schemas.UserCreateProAdmin(
                email=user.email,
                permissions_uuid=permissions_map["User"],
                first_name=user.first_name,
                last_name=user.last_name,
            )
            extra_info = schemas.RegisterProUser(
                inviting_uuid=self.admin_user.uuid,
                inviting_email=self.admin_user.email,
            )

            invite_uuid = await register_pro_user(self.db, user_create, extra_info, from_oauth=True)
            if not invite_uuid or not await self.create_user(invite_uuid, user.email):
                raise RuntimeError(f"Could not provision account {user.email}")

        await self.db.commit()


async def setup_configs(config_path: Path = CONFIG_PATH, default_entity: str | None = None):
    configs = []
    files = list(config_path.glob("*.toml"))
    if not files:
        raise ValueError(f"No account configurations found in {config_path}")
    for file in files:
        with file.open("rb") as f:
            configs.append(Config(**tomllib.load(f)))

    if default_entity is None:
        if len(configs) > 1:
            raise ValueError("Multiple organization configurations require --default-entity NAME")
        default_entity = configs[0].entity.name
    if default_entity not in {config.entity.name for config in configs}:
        raise ValueError(f"No configuration found for default entity {default_entity}")

    async for db in aget_write_db():
        for config in configs:
            await SetupConfig(config, db).run(registration_default=config.entity.name == default_entity)


if __name__ == "__main__":
    import argparse
    import asyncio

    parser = argparse.ArgumentParser(
        description="Provision local entities and accounts.",
        epilog="Run migrations before provisioning accounts.",
    )
    parser.add_argument(
        "-c", "--config-dir", type=Path, default=CONFIG_PATH,
        help="Directory containing entity/account TOML files.",
    )
    parser.add_argument(
        "-d", "--default-entity",
        help="Organization name used for registration defaults; required with multiple configs.",
    )
    args: argparse.Namespace = parser.parse_args()
    asyncio.run(setup_configs(args.config_dir, args.default_entity))
