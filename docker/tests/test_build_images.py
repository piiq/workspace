"""The build script loads local images and stops on build failure."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = Path(__file__).resolve().parents[2] / "scripts/build-images.sh"


@pytest.fixture
def invoke(tmp_path):
    calls = tmp_path / "calls.jsonl"
    docker = tmp_path / "docker"
    docker.write_text(
        f"#!{sys.executable}\n"
        + """import json, os, sys
args = sys.argv[1:]
with open(os.environ['CALL_LOG'], 'a') as output:
    output.write(json.dumps(args) + '\\n')
if args[args.index('--target') + 1] == os.environ.get('FAIL_TARGET'):
    raise SystemExit(17)
"""
    )
    docker.chmod(0o755)

    def run(*arguments, fail_target="", cache=False):
        environment = {
            **os.environ,
            "PATH": f"{tmp_path}:{os.environ['PATH']}",
            "CALL_LOG": str(calls),
            "FAIL_TARGET": fail_target,
            "BUILD_CACHE_FROM": "type=local,src=cache" if cache else "",
            "BUILD_CACHE_TO": "type=local,dest=next,mode=max" if cache else "",
        }
        environment.pop("GITHUB_REPOSITORY", None)
        result = subprocess.run(
            [str(SCRIPT), *arguments],
            env=environment,
            text=True,
            capture_output=True,
            check=False,
        )
        recorded = (
            [json.loads(line) for line in calls.read_text().splitlines()]
            if calls.exists()
            else []
        )
        return result, recorded

    return run


def test_build_loads_each_target_with_local_names(invoke):
    result, calls = invoke("--platform", "linux/arm64", "--tag", "example")
    assert result.returncode == 0, result.stderr
    assert [call[call.index("--target") + 1] for call in calls] == [
        "frontend",
        "backend",
        "workspace",
    ]
    for call, image in zip(
        calls, ("workspace-frontend", "workspace-backend", "workspace"), strict=True
    ):
        assert call[:2] == ["buildx", "build"]
        assert "--load" in call
        assert call[call.index("--platform") + 1] == "linux/arm64"
        assert call[call.index("--tag") + 1] == f"{image}:example"


def test_default_build_uses_docker_platform_and_dev_tag(invoke):
    result, calls = invoke()
    assert result.returncode == 0, result.stderr
    assert len(calls) == 3
    assert all("--platform" not in call for call in calls)
    assert all(call[call.index("--tag") + 1].endswith(":dev") for call in calls)


def test_build_failure_stops_subsequent_targets(invoke):
    result, calls = invoke(fail_target="backend")
    assert result.returncode == 17, result.stderr
    assert [call[call.index("--target") + 1] for call in calls] == [
        "frontend",
        "backend",
    ]


def test_shared_cache_exports_after_all_targets(invoke):
    result, calls = invoke(cache=True)
    assert result.returncode == 0, result.stderr
    assert all("--cache-from" in call for call in calls)
    assert ["--cache-to" in call for call in calls] == [False, False, True]


@pytest.mark.parametrize(
    "arguments",
    [
        ("--push",),
        ("publish",),
        ("--image-prefix", "ghcr.io/example/workspace"),
        ("--release-tag", "v1"),
        ("--platform", "linux/ppc64le"),
    ],
)
def test_unsupported_arguments_fail_before_docker(invoke, arguments):
    result, calls = invoke(*arguments)
    assert result.returncode == 2, result.stderr
    assert not calls
