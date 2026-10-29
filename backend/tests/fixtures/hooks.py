"""Pytest hooks for backend test suite."""

import pathlib
from contextlib import closing

import pytest


def pytest_addoption(parser):
    parser.addoption(
        "--require-docker",
        action="store_true",
        help="Fail before running tests when Docker is unavailable.",
    )


def pytest_sessionstart(session):
    if session.config.getoption("--require-docker"):
        import docker

        try:
            with closing(docker.from_env()) as client:
                client.ping()
        except docker.errors.DockerException as exc:
            raise pytest.UsageError(
                "Docker is required for these tests. Start Docker and rerun the command."
            ) from exc


def pytest_collection_modifyitems(items):
    """Automatically mark all tests in this directory with @pytest.mark.integration."""
    integration_dir = pathlib.Path(__file__).resolve().parents[1]

    for item in items:
        if str(integration_dir) in str(item.fspath):
            item.add_marker(pytest.mark.integration)
