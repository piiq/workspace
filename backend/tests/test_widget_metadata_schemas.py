"""Widget renderer IDs and state in API payloads."""

import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

import pytest
import sqlalchemy as sa
from pydantic import TypeAdapter, ValidationError
from sqlalchemy.orm import Session

from api import models
from api.schemas import (
    RENDERER_ID_PATTERN,
    DashboardSave,
    MetaDataWidgetType,
    WidgetMetadataResponse,
    WidgetMetadataResponsePatch,
)


def test_renderer_pattern_matches_widget_builder():
    schema_path = (
        Path(__file__).resolve().parents[2]
        / "frontend/src/components/DataConnectors/WidgetsBuilder/widget-schema.json"
    )
    properties = json.loads(schema_path.read_text())["additionalProperties"]["properties"]
    for name in ("type", "defaultViz"):
        pattern = properties[name]["anyOf"][0]["anyOf"][1]["pattern"]
        assert pattern.replace(r"\/", "/") == RENDERER_ID_PATTERN


@pytest.mark.parametrize(
    "widget_type",
    [
        "iframe",
        "rss_viewer",
        "rich_note",
        "copilot_table",
        "youtube",
        "widget_studio",
        "chart",
        "html",
        "ag_chart_from_table",
        "@example/analytics/table",
        "@example-org/data-tools/price-table",
        "@1/2/3",
    ],
)
def test_widget_type_accepts_builtin_and_qualified_renderer_ids(widget_type):
    assert TypeAdapter(MetaDataWidgetType).validate_python(widget_type) == widget_type


@pytest.mark.parametrize(
    "widget_type",
    [
        "unknown",
        "example/analytics/table",
        "@example/analytics",
        "@example/analytics/table/extra",
        "@Example/analytics/table",
        "@example/analytics/price_table",
        "@example/analytics/-table",
        "@example/analytics/table-",
        "@example/analytics/price--table",
        "@example/analytics/table\n",
        "",
    ],
)
def test_widget_type_rejects_invalid_renderer_ids(widget_type):
    with pytest.raises(ValidationError):
        TypeAdapter(MetaDataWidgetType).validate_python(widget_type)


def test_widget_metadata_create_patch_and_dashboard_save_preserve_plugin_state():
    widget_id = uuid4()
    renderer_id = "@example-org/portfolio-analysis/custom-table"
    state = {"parameters": {"symbols": ["AAPL", "MSFT"]}, "selection": {"row": 3}, "extension": [1, None, True]}
    config = {"renderer": {"columns": ["symbol", "price"], "theme": "dark"}, "custom": {"anything": [1, "two"]}}
    payload = {
        "widgetId": str(widget_id),
        "widgetType": renderer_id,
        "name": "Portfolio",
        "description": "Portfolio data",
        "source": "local",
        "category": "testing",
        "subCategory": "testing",
        "storage": state,
        "widgetConfig": config,
    }

    metadata = WidgetMetadataResponse.model_validate(payload)
    assert WidgetMetadataResponse.model_validate_json(metadata.model_dump_json(by_alias=True)) == metadata
    assert metadata.widget_type == renderer_id
    assert metadata.storage == state
    assert metadata.widget_config == config

    patch = WidgetMetadataResponsePatch.model_validate(
        {"widgetType": renderer_id, "storage": state, "widgetConfig": config}
    )
    assert patch.model_dump(by_alias=True, exclude_unset=True) == {
        "widgetType": renderer_id,
        "storage": state,
        "widgetConfig": config,
    }

    content = {"widgets": [{"id": str(widget_id), "type": renderer_id, "storage": state, "widgetConfig": config}]}
    saved = DashboardSave(uuid=uuid4(), content=content, created_date=datetime.now(UTC))
    assert DashboardSave.model_validate_json(saved.model_dump_json()).content == content


def test_sqlite_widget_metadata_preserves_renderer_id_and_state(tmp_path):
    engine = sa.create_engine(f"sqlite:///{tmp_path / 'widgets.db'}")
    models.WidgetMetadata.__table__.create(engine)
    widget_id = uuid4()
    renderer_id = "@example-org/independent-portfolio-analysis-plugin/interactive-price-table"
    storage = {"params": {"symbol": "AAPL"}, "customState": {"selectedRows": [2, 4]}}
    config = {"nested": {"sort": [{"column": "price", "direction": "asc"}], "other": None}}

    try:
        with Session(engine) as session:
            session.add(
                models.WidgetMetadata(
                    user_uuid=uuid4(),
                    widget_id=widget_id,
                    name="Portfolio",
                    description="Portfolio data",
                    source="local",
                    category="testing",
                    sub_category="testing",
                    widget_type=renderer_id,
                    storage=storage,
                    widget_config=config,
                )
            )
            session.commit()

        with Session(engine) as session:
            widget = session.scalars(
                sa.select(models.WidgetMetadata).where(models.WidgetMetadata.widget_id == widget_id)
            ).one()
            assert widget.widget_type == renderer_id
            assert widget.storage == storage
            assert widget.widget_config == config

            updated_state = {"params": {"symbol": "MSFT"}, "customState": {"selectedRows": [1]}}
            patch = WidgetMetadataResponsePatch(storage=updated_state)
            for key, value in patch.model_dump(exclude_unset=True).items():
                setattr(widget, key, value)
            session.commit()

        with Session(engine) as session:
            widget = session.scalars(
                sa.select(models.WidgetMetadata).where(models.WidgetMetadata.widget_id == widget_id)
            ).one()
            assert widget.widget_type == renderer_id
            assert widget.storage == updated_state
            assert widget.widget_config == config
    finally:
        engine.dispose()
