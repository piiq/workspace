"""Chat search terms retain their PostgreSQL prefix matching."""

import pytest
from sqlalchemy import column

from api import models
from api.crud import get_match_exprs
from utilities.config import settings


@pytest.fixture(autouse=True)
def postgresql_search_columns(monkeypatch):
    for model in (models.ChatMessages, models.CopilotChat):
        monkeypatch.setattr(model, "search_vector", column("search_vector"), raising=False)


@pytest.mark.parametrize(
    ("term", "expected"),
    [("revenue growth", ["revenue", "growth:*"]), ("café", ["café:*"]), ("revenue!", ["revenue!"])],
)
def test_postgresql_prefix_matches(monkeypatch, term, expected):
    monkeypatch.setattr(settings, "DATABASE_TYPE", "postgresql")
    expressions = get_match_exprs(term)
    assert [expr.right.value for expr in expressions[: len(expected) * 2 : 2]] == expected


def test_long_nonmatching_search_term(monkeypatch):
    monkeypatch.setattr(settings, "DATABASE_TYPE", "postgresql")
    term = "a" * 100_000 + "!"
    expressions = get_match_exprs(term)
    assert expressions[0].right.value == term
