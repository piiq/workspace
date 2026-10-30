from datetime import datetime
from typing import Literal
from uuid import UUID

from api import hubspot
from api.email.abstract import EmailAbstract


class HubSpotEmail(EmailAbstract):
    @staticmethod
    def send_welcome_email(to: str) -> None:
        return hubspot.send_welcome_email(to)

    @staticmethod
    def send_invite_emails(from_email: str, to_emails: list[str]) -> None:
        return hubspot.send_invite_emails(from_email, to_emails)

    @staticmethod
    def send_confirmation(token: str, to: str) -> None:
        return hubspot.send_confirmation(token, to)

    @staticmethod
    def send_create_account(
        token: UUID,
        to: str,
        password: str,
        inviter: str,
        message: None | str = None,
    ) -> None:
        return hubspot.send_create_account(
            token, to, password, inviter, message
        )

    @staticmethod
    def send_password_reset(token: str, to: str) -> None:
        return hubspot.send_password_reset(token, to)

    @staticmethod
    def send_password_reset_confirmation(to: str) -> None:
        return hubspot.send_password_reset_confirmation(to)

    @staticmethod
    def send_support_received(to: str) -> None:
        return hubspot.send_support_received(to)

    @staticmethod
    def send_pat_warning(to: str, exp: datetime) -> None:
        return hubspot.send_pat_warning(to, exp)

    @staticmethod
    def send_share_notice(to: str, sharer: str, dashboard_uuid: UUID) -> None:
        return hubspot.send_share_notice(to, sharer, dashboard_uuid)

    @staticmethod
    def send_account_takeover(
        token: str, to: str, inviter: str, message: None | str = None
    ) -> None:
        return hubspot.send_account_takeover(token, to, inviter, message)

    @staticmethod
    def send_dynamic_template(
        to: str,
        template: Literal["welcome", "welcome-error", "sfa01", "ica01", "spa02"],
    ) -> None:
        return hubspot.send_dynamic_template(to, template)

    @staticmethod
    def send_new_entity(to: str, entity_name: str) -> None:
        return hubspot.send_new_entity(to, entity_name)
