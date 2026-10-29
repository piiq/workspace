"""Account access, sharing, and deployment resource limits."""

from datetime import timedelta
import json
from pathlib import Path
from runpy import run_path
from unittest.mock import AsyncMock, Mock
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import delete, select, update

from api import base, crud, models
from api.storage import FileStorage
from routers.entity import takeover_user
from routers.pro.index import process_create_user
from routers.pro.workspace_mcp.auth import validate_workspace_mcp_token
from scripts.init_users import Config, SetupConfig, setup_configs
from tests.fixtures.base import _ADMIN_USER, _AUTH_USER
from utilities.config import settings


async def test_members_have_features_without_admin_access(auth_client, admin_client):
    member = await auth_client.get("/pro/validate-and-sync")
    admin = await admin_client.get("/pro/validate-and-sync")
    assert member.status_code == admin.status_code == 200
    assert member.json()["account_permissions"] == {"admin_access": False, "allow_custom_backends": True}
    assert admin.json()["account_permissions"] == {"admin_access": True, "allow_custom_backends": True}
    assert "feature_entitlements" not in member.json()
    assert (await auth_client.get("/pro/2fa")).status_code == 200
    assert (await auth_client.get("/pro/data-connectors/api-source")).status_code == 200
    assert (await auth_client.get("/admin/users")).status_code == 403


async def test_commercial_account_routes_are_unavailable(auth_client):
    for method, path in (
        ("PUT", "/pro/tier"),
        ("GET", "/pro/entitlement"),
        ("GET", f"/entity/entitlement/{uuid4()}"),
        ("GET", f"/admin/entitlement/{uuid4()}"),
        ("GET", f"/admin/extend-trial/{uuid4()}"),
        ("GET", "/pro/invites/remaining"),
        ("GET", "/pro/zero-to-hero"),
        ("POST", "/pro/zero-to-hero"),
    ):
        assert (await auth_client.request(method, path)).status_code == 404


async def test_call_limit_applies_to_first_and_subsequent_updates(auth_client, monkeypatch):
    monkeypatch.setattr(settings, "COPILOT_CALLS_PER_DAY", 2)
    settings.redis_cache(f"usage:{_AUTH_USER['user_uuid']}", delete=True)
    assert (await auth_client.put("/pro/usage", json={"add_copilot_count": 3})).status_code == 422
    accepted = await auth_client.put("/pro/usage", json={"add_copilot_count": 2})
    assert accepted.status_code == 200
    assert accepted.json()["number_copilot_calls_day_count"] == 2
    assert accepted.json()["copilot_calls_limit"] == 2
    assert (await auth_client.put("/pro/usage", json={"add_copilot_count": 1})).status_code == 422


@pytest.mark.parametrize("field", ["reset_copilot_count", "subtract_copilot_count"])
async def test_members_cannot_reset_resource_counters(auth_client, field):
    response = await auth_client.put("/pro/usage", json={field: 1})
    assert response.status_code == 422


async def test_storage_limit_checks_the_whole_upload_before_writing(auth_client, db_session, monkeypatch):
    monkeypatch.setattr(settings, "FILE_UPLOAD_LIMIT_GB", 8 / 1024**3)
    upload = AsyncMock()
    monkeypatch.setattr(FileStorage, "upload_pending_file", upload)
    stored = models.StoredFile(
        creater_uuid=UUID(_AUTH_USER["user_uuid"]),
        s3_file_name=f"{uuid4()}.csv",
        bucket="test",
        extension="csv",
        original_file_name="existing.csv",
        size=4,
    )
    db_session.add(stored)
    await db_session.commit()
    try:
        response = await auth_client.post(
            "/pro/files",
            files=[
                ("files", ("first.csv", b"12", "text/csv")),
                ("files", ("second.csv", b"345", "text/csv")),
            ],
        )
        assert response.status_code == 413
        upload.assert_not_called()
    finally:
        await db_session.delete(stored)
        await db_session.commit()


async def test_membership_removal_invalidates_sessions_and_mcp_tokens(auth_client, admin_client, db_session):
    role = models.PermissionsEntityMap(
        name="User",
        entity_uuid=UUID(_ADMIN_USER["entity_uuid"]),
    )
    db_session.add(role)
    shared_app = models.UserApp(user_uuid=UUID(_ADMIN_USER["user_uuid"]), content={"name": "Shared app"})
    db_session.add(shared_app)
    await db_session.flush()
    db_session.add(models.UserAppShare(user_app_uuid=shared_app.uuid, shared_user_uuid=UUID(_AUTH_USER["user_uuid"])))
    await db_session.execute(
        update(models.User)
        .where(
            models.User.uuid == UUID(_AUTH_USER["user_uuid"]),
        )
        .values(permissions_uuid=role.uuid)
    )
    await db_session.commit()
    try:
        token_response = await auth_client.post("/pro/workspace-mcp/tokens", json={"name": "Test access"})
        assert token_response.status_code == 200
        token = token_response.json()["token"]
        assert await validate_workspace_mcp_token(db_session, token) == UUID(_AUTH_USER["user_uuid"])
        removed = await admin_client.delete(f"/admin/users/{_AUTH_USER['user_uuid']}/remove")
        assert removed.status_code == 200
        assert (
            await db_session.scalar(
                select(models.UserAppShare).where(
                    models.UserAppShare.shared_user_uuid == UUID(_AUTH_USER["user_uuid"]),
                )
            )
            is None
        )
        assert (await auth_client.get("/pro/user")).status_code == 401
        with pytest.raises(HTTPException) as error:
            await validate_workspace_mcp_token(db_session, token)
        assert error.value.status_code == 401
    finally:
        await db_session.delete(shared_app)
        await db_session.delete(role)
        await db_session.commit()


async def test_default_administrator_can_be_found_for_password_reset(db_session):
    user = await crud.get_user(db_session, {"email": settings.DEFAULT_INVITER_EMAIL})
    assert user is not None
    assert user.email == settings.DEFAULT_INVITER_EMAIL


@pytest.mark.parametrize("superuser", [False, True])
async def test_cross_organization_provisioning_requires_superuser(auth_client, admin_client, db_session, superuser):
    await db_session.execute(
        update(models.User)
        .where(
            models.User.uuid == UUID(_ADMIN_USER["user_uuid"]),
        )
        .values(is_superuser=superuser)
    )
    await db_session.commit()
    email = f"member-{uuid4().hex}@example.com"
    response = await admin_client.post(
        "/admin/create-user",
        json={
            "email": email,
            "permissions_uuid": _AUTH_USER["perm_uuid"],
        },
    )
    assert response.status_code == (200 if superuser else 403)
    if superuser:
        user_uuid = await db_session.scalar(select(models.User.uuid).where(models.User.email == email))
        await crud.full_delete_user(db_session, user_uuid)


@pytest.mark.parametrize("kind", ["dashboard", "app"])
async def test_only_owners_can_list_pending_share_invitations(auth_client, admin_client, db_session, kind):
    owner = UUID(_ADMIN_USER["user_uuid"])
    resource = (
        models.DashboardItem(owner_uuid=owner, creator_uuid=owner, content={"data": {}})
        if kind == "dashboard"
        else models.UserApp(user_uuid=owner, content={"name": "Private app"})
    )
    db_session.add(resource)
    await db_session.flush()
    shares = {str(resource.uuid): "view"}
    invite = models.PermissionsInvite(
        user_uuid=UUID(_AUTH_USER["user_uuid"]),
        permissions_uuid=UUID(_ADMIN_USER["perm_uuid"]),
        expiration_date=base.get_now() + timedelta(days=1),
        **({"shared_dashboards": shares} if kind == "dashboard" else {"shared_apps": shares}),
    )
    db_session.add(invite)
    await db_session.commit()
    prefix = "/pro/dash" if kind == "dashboard" else "/pro/user-apps"
    try:
        denied = await auth_client.get(f"{prefix}/{resource.uuid}/shares")
        assert denied.status_code == 403
        assert (await admin_client.get(f"{prefix}/{resource.uuid}/shares")).status_code == 200
    finally:
        await db_session.delete(invite)
        await db_session.delete(resource)
        await db_session.commit()


@pytest.mark.parametrize("kind", ["dashboard", "app"])
@pytest.mark.parametrize("existing", [False, True])
async def test_accepting_share_invites_grants_resource_and_file_access(
    auth_client, db_session, kind, existing, monkeypatch
):
    monkeypatch.setattr(settings, "DISABLE_REGISTRATION", False)
    owner = UUID(_AUTH_USER["user_uuid"])
    member_role = models.PermissionsEntityMap(name="User", entity_uuid=UUID(_AUTH_USER["entity_uuid"]))
    resource = (
        models.DashboardItem(owner_uuid=owner, creator_uuid=owner, content={"data": {}})
        if kind == "dashboard"
        else models.UserApp(user_uuid=owner, content={"name": "Shared app"})
    )
    additional_resource = (
        models.DashboardItem(owner_uuid=owner, creator_uuid=owner, content={"data": {}})
        if kind == "dashboard"
        else models.UserApp(user_uuid=owner, content={"name": "Another shared app"})
    )
    db_session.add_all([member_role, resource, additional_resource])
    await db_session.commit()
    email = f"recipient-{uuid4().hex}@example.com"
    prefix = "/pro/dash" if kind == "dashboard" else "/pro/user-apps"
    recipient = None
    invite = None
    try:
        if existing:
            account = models.User(
                email=email, clean_email=base.clean_email(email), password="TestPassword123!", confirmed=True
            )
            db_session.add(account)
            await db_session.commit()
            recipient = account.uuid
        response = await auth_client.post(f"{prefix}/{resource.uuid}/share", json={"shares": {email: "view"}})
        assert response.status_code == 200
        repeated = await auth_client.post(
            f"{prefix}/{additional_resource.uuid}/share", json={"shares": {email: "comment"}}
        )
        assert repeated.status_code == 200
        invite = (
            await db_session.scalar(
                select(models.PermissionsInvite).where(models.PermissionsInvite.user_uuid == recipient)
            )
            if existing
            else await db_session.scalar(select(models.UserProInvite).where(models.UserProInvite.email == email))
        )
        assert invite.permissions_uuid == member_role.uuid
        if existing:
            assert (await takeover_user(invite.uuid, db_session)).success
        else:
            recipient = await process_create_user(invite.uuid, email, db_session, from_oauth=True)
        share_model = models.DashboardShare if kind == "dashboard" else models.UserAppShare
        shares = (await db_session.scalars(select(share_model).where(share_model.shared_user_uuid == recipient))).all()
        assert {share.permissions for share in shares} == {base.PermissionEnum.view, base.PermissionEnum.comment}
        file_shares = (
            await db_session.scalars(
                select(models.StoredFileShare).where(
                    models.StoredFileShare.shared_user_uuid == recipient,
                )
            )
        ).all()
        assert {share.dashboard_item_uuid if kind == "dashboard" else share.user_app_uuid for share in file_shares} == {
            resource.uuid,
            additional_resource.uuid,
        }
    finally:
        if recipient:
            await db_session.execute(
                delete(models.StoredFileShare).where(models.StoredFileShare.shared_user_uuid == recipient)
            )
            await db_session.execute(
                delete(models.DashboardShare).where(models.DashboardShare.shared_user_uuid == recipient)
            )
            await db_session.execute(delete(models.UserAppShare).where(models.UserAppShare.shared_user_uuid == recipient))
            await crud.full_delete_user(db_session, recipient)
        elif invite:
            await db_session.delete(invite)
        await db_session.delete(resource)
        await db_session.delete(additional_resource)
        await db_session.delete(member_role)
        await db_session.commit()


async def test_provisioning_can_repeat_and_add_members(auth_client, db_session, monkeypatch, tmp_path):
    monkeypatch.setattr("scripts.init_users.USER_CREATE_JSON_PATH", tmp_path / "user_create.json")
    suffix = uuid4().hex
    config = Config.model_validate(
        {
            "entity": {
                "name": f"Provisioning {suffix}",
                "aum": 0,
                "company_type": "OTHER",
                "organization_size": "SMALL",
                "country": "DOM",
            },
            "admins": [
                {
                    "email": f"admin-{suffix}@example.com",
                    "first_name": "Admin",
                    "last_name": "Test",
                    "password": "TestPassword123!",
                }
            ],
            "users": [{"email": f"member-{suffix}@example.com", "first_name": "Member", "last_name": "Test"}],
        }
    )
    entity = None
    try:
        await SetupConfig(config, db_session).run()
        config.users.append(config.users[0].model_copy(update={"email": f"another-{suffix}@example.com"}))
        await SetupConfig(config, db_session).run()
        entity = await db_session.scalar(select(models.Entity).where(models.Entity.name == config.entity.name))
        users = (
            await db_session.scalars(
                select(models.User)
                .join(models.PermissionsEntityMap)
                .where(
                    models.PermissionsEntityMap.entity_uuid == entity.uuid,
                )
            )
        ).all()
        assert {user.email for user in users} == {user.email for user in [*config.admins, *config.users]}
    finally:
        for account in [*config.users, *config.admins]:
            user_uuid = await db_session.scalar(select(models.User.uuid).where(models.User.email == account.email))
            if user_uuid:
                await crud.full_delete_user(db_session, user_uuid)
        if entity:
            await db_session.execute(
                delete(models.PermissionsEntityMap).where(
                    models.PermissionsEntityMap.entity_uuid == entity.uuid,
                )
            )
            await db_session.delete(entity)
            await db_session.commit()


def test_provisioning_requires_an_administrator():
    with pytest.raises(ValidationError, match="admins"):
        Config.model_validate(
            {
                "entity": {
                    "name": "Workspace",
                    "aum": 0,
                    "company_type": "OTHER",
                    "organization_size": "SMALL",
                    "country": "DOM",
                },
                "admins": [],
                "users": [{"email": "member@example.com", "first_name": "Test", "last_name": "Member"}],
            }
        )


def test_membership_cleanup_removes_owned_resources_from_pending_invitations():
    dashboard, app = uuid4(), uuid4()
    assert crud.get_updated_share_values([dashboard], {str(dashboard): "view"}, [], None) == {"shared_dashboards": {}}
    assert crud.get_updated_share_values([], None, [app], {str(app): "view"}) == {"shared_apps": {}}


@pytest.mark.parametrize("allowed", [False, True])
async def test_organization_controls_personal_backends(auth_client, admin_client, db_session, allowed):
    entity_uuid = UUID(_AUTH_USER["entity_uuid"])
    personal = models.ApiSource(
        user_uuid=UUID(_AUTH_USER["user_uuid"]), name="Personal", url="https://personal.example.com"
    )
    managed = models.ApiSource(entity_uuid=entity_uuid, name="Managed", url="https://managed.example.com")
    unrelated = models.ApiSource(
        entity_uuid=UUID(_ADMIN_USER["entity_uuid"]), name="Other", url="https://other.example.com"
    )
    db_session.add_all([personal, managed, unrelated])
    await db_session.execute(
        update(models.User).where(models.User.uuid == UUID(_ADMIN_USER["user_uuid"])).values(is_superuser=True)
    )
    await db_session.commit()
    new_uuid = uuid4()
    policy = {
        "name": _AUTH_USER["entity_name"],
        "entity_code": _AUTH_USER["entity_type_uuid"],
        "email": _AUTH_USER["entity_email"],
        "company_type": "OTHER",
        "organization_size": "SMALL",
        "aum": 0,
        "country": "DOM",
        "allow_custom_backends": allowed,
    }
    try:
        assert (await auth_client.put(f"/entity/entity/{entity_uuid}", json=policy)).status_code == 401
        assert (await admin_client.put(f"/entity/entity/{entity_uuid}", json=policy)).status_code == 200
        entities = (await admin_client.get("/entity/entity")).json()["items"]
        assert (
            next(entity for entity in entities if entity["uuid"] == str(entity_uuid))["allow_custom_backends"] is allowed
        )
        permissions = (await auth_client.get("/pro/validate-and-sync")).json()["account_permissions"]
        assert permissions["allow_custom_backends"] is allowed
        expected = {str(managed.uuid), str(personal.uuid)} if allowed else {str(managed.uuid)}
        listed = (await auth_client.get("/pro/data-connectors/api-source")).json()
        assert {source["id"] for source in listed} == expected
        profile = (await auth_client.get("/pro/user")).json()
        assert {source["id"] for source in profile["api_sources"]} == expected
        for source_uuid in [personal.uuid, new_uuid]:
            response = await auth_client.post(
                f"/pro/data-connectors/api-source/{source_uuid}",
                json={
                    "name": "Updated",
                    "url": "https://updated.example.com",
                    "allow_custom_backends": True,
                },
            )
            assert response.status_code == (200 if allowed else 403)
        managed_update = await auth_client.post(
            f"/pro/data-connectors/api-source/{managed.uuid}",
            json={
                "name": "Forbidden edit",
                "url": "https://updated.example.com",
            },
        )
        assert managed_update.status_code == 403
        other_permissions = (await admin_client.get("/pro/validate-and-sync")).json()["account_permissions"]
        assert other_permissions["allow_custom_backends"] is True
    finally:
        await db_session.execute(
            delete(models.ApiSource).where(
                models.ApiSource.uuid.in_(
                    [
                        personal.uuid,
                        managed.uuid,
                        unrelated.uuid,
                        new_uuid,
                    ]
                )
            )
        )
        await db_session.execute(
            update(models.Entity).where(models.Entity.uuid == entity_uuid).values(allow_custom_backends=True)
        )
        await db_session.commit()


async def test_multiple_organizations_require_explicit_registration_default(
    auth_client, db_session, monkeypatch, tmp_path
):
    defaults = tmp_path / "user_create.json"
    monkeypatch.setattr("scripts.init_users.USER_CREATE_JSON_PATH", defaults)
    names = [f"First {uuid4().hex}", f"Second {uuid4().hex}"]
    emails = [f"admin-{uuid4().hex}@example.com" for _ in names]
    existing_types = set(await db_session.scalars(select(models.EntityType.uuid)))
    await db_session.commit()
    for index, (name, email) in enumerate(zip(names, emails, strict=True)):
        (tmp_path / f"{index}.toml").write_text(f"""[entity]
name = "{name}"
aum = 0
company_type = "OTHER"
organization_size = "SMALL"
country = "DOM"
[[admins]]
email = "{email}"
first_name = "Admin"
last_name = "Test"
password = "TestPassword123!"
""")
    with pytest.raises(ValueError, match="--default-entity"):
        await setup_configs(tmp_path)
    with pytest.raises(ValueError, match="No configuration found"):
        await setup_configs(tmp_path, "Missing")
    try:
        await setup_configs(tmp_path, names[0])
        selected = json.loads(defaults.read_text())
        role = await db_session.get(models.PermissionsEntityMap, UUID(selected["permissions_uuid"]))
        entity = await db_session.get(models.Entity, role.entity_uuid)
        assert entity.name == names[0]
        assert role.name == "User"
        assert selected["inviting_email"] == emails[0]
        assert set(await db_session.scalars(select(models.Entity.name).where(models.Entity.name.in_(names)))) == set(
            names
        )
    finally:
        for email in emails:
            user_uuid = await db_session.scalar(select(models.User.uuid).where(models.User.email == email))
            if user_uuid:
                await crud.full_delete_user(db_session, user_uuid)
        entities = (await db_session.scalars(select(models.Entity).where(models.Entity.name.in_(names)))).all()
        created_types = {entity.entity_type_uuid for entity in entities} - existing_types
        for entity in entities:
            await db_session.execute(
                delete(models.PermissionsEntityMap).where(models.PermissionsEntityMap.entity_uuid == entity.uuid)
            )
            await db_session.delete(entity)
        await db_session.execute(delete(models.EntityType).where(models.EntityType.uuid.in_(created_types)))
        await db_session.commit()


def test_admin_cli_preserves_personal_backend_policy(monkeypatch):
    client_type = run_path(str(Path(__file__).resolve().parents[2] / "admin_cli/openbb-admin"))["HubAPIClient"]
    client = client_type("https://workspace.example.com")
    organization = {
        "uuid": "organization",
        "entity_type": {"uuid": "type"},
        "name": "Workspace",
        "email": "admin@example.com",
        "company_type": "OTHER",
        "organization_size": "SMALL",
        "aum": 0,
        "country": "DOM",
        "allow_custom_backends": False,
    }
    transport = Mock(side_effect=[{"items": [organization], "pages": 1}, {"success": True}])
    monkeypatch.setattr(client, "_request", transport)
    client.entity_update("organization", aum=123)
    method, path, payload = transport.call_args.args
    assert method == "PUT"
    assert path == "/entity/entity/organization"
    assert payload["allow_custom_backends"] is False
    assert payload["aum"] == 123
