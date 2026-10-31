"""Inline suppression filtering preserves unmarked findings and SARIF metadata."""

import copy
import json
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / ".github/scripts/filter_codeql_sarif.py"


def invoke(*paths):
    return subprocess.run(
        [sys.executable, str(SCRIPT), *map(str, paths)],
        text=True,
        capture_output=True,
        check=False,
    )


def test_removes_marked_results_and_preserves_other_findings(tmp_path):
    findings = [
        {
            "ruleId": "py/clear-text-storage-sensitive-data",
            "message": {"text": "Unmarked credentials"},
        },
        {
            "ruleId": "py/clear-text-storage-sensitive-data",
            "suppressions": [{"kind": "inSource"}],
        },
        {"ruleId": "js/incomplete-sanitization", "suppressions": []},
        {"ruleId": "other/rule", "suppressions": [{"kind": "external"}]},
        {"ruleId": "other/rule", "suppressions": [{}]},
    ]
    report = {
        "version": "2.1.0",
        "runs": [
            {
                "tool": {"driver": {"name": "CodeQL", "rules": [{"id": "other/rule"}]}},
                "results": findings,
            },
            {
                "tool": {"driver": {"name": "CodeQL"}},
                "artifacts": [{"location": {"uri": "example.py"}}],
            },
        ],
    }
    expected = copy.deepcopy(report)
    del expected["runs"][0]["results"][1]
    path = tmp_path / "python.sarif"
    path.write_text(json.dumps(report))

    result = invoke(path)

    assert result.returncode == 0, result.stderr
    assert json.loads(path.read_text()) == expected
    assert "removed 1 inline-suppressed findings" in result.stdout


def test_handles_multiple_languages_and_repeated_filtering(tmp_path):
    paths = []
    for language in ("python", "javascript"):
        path = tmp_path / f"{language}.sarif"
        path.write_text(
            json.dumps(
                {"runs": [{"results": [{"suppressions": [{"kind": "inSource"}]}]}]}
            )
        )
        paths.append(path)

    result = invoke(*paths)

    assert result.returncode == 0, result.stderr
    for path in paths:
        assert json.loads(path.read_text())["runs"][0]["results"] == []
    result = invoke(*paths)
    assert result.returncode == 0, result.stderr
    assert result.stdout.count("removed 0") == 2


@pytest.mark.parametrize("contents", ["not JSON", '{"version": "2.1.0"}'])
def test_invalid_reports_fail_without_replacing_the_file(tmp_path, contents):
    path = tmp_path / "invalid.sarif"
    path.write_text(contents)

    assert invoke(path).returncode != 0
    assert path.read_text() == contents


def test_missing_reports_fail(tmp_path):
    assert invoke(tmp_path / "missing.sarif").returncode != 0


def test_workflow_filters_before_upload_and_preserves_default_queries():
    workflow = yaml.safe_load((ROOT / ".github/workflows/codeql.yml").read_text())
    analysis = workflow["jobs"]["analyze"]
    steps = analysis["steps"]
    analyze = next(
        step for step in steps if step.get("uses") == "github/codeql-action/analyze@v4"
    )
    filter_step = next(
        step for step in steps if step.get("name") == "Apply inline suppressions"
    )
    upload = next(
        step
        for step in steps
        if step.get("uses") == "github/codeql-action/upload-sarif@v4"
    )

    assert analyze["with"]["upload"] == "failure-only"
    assert steps.index(analyze) < steps.index(filter_step) < steps.index(upload)
    assert {item["language"] for item in analysis["strategy"]["matrix"]["include"]} == {
        "python",
        "javascript-typescript",
        "actions",
    }
    assert "disable-default-queries" not in str(workflow)
    assert "paths-ignore" not in str(workflow)
    assert not any(
        key in analysis["permissions"] and analysis["permissions"][key] == "write"
        for key in ("contents", "packages")
    )
