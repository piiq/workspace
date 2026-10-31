"""Exercise the description workflow against a fake GitHub API."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest
import yaml

WORKFLOW = (
    Path(__file__).resolve().parents[1] / "workflows/dependabot-pr-descriptions.yml"
)
CONFIG = yaml.safe_load(WORKFLOW.read_text())
SCRIPT = CONFIG["jobs"]["format"]["steps"][0]["run"]


def pull(number, body, *, login="dependabot[bot]", user_type="Bot", state="open"):
    return {
        "number": number,
        "body": body,
        "user": {"login": login, "type": user_type},
        "state": state,
    }


@pytest.fixture
def invoke(tmp_path):
    fixtures = tmp_path / "pulls.json"
    patches = tmp_path / "patches.jsonl"
    event = tmp_path / "event.json"
    executable = tmp_path / "gh"
    executable.write_text(
        f"#!{sys.executable}\n"
        + """import json, os, pathlib, sys
args = sys.argv[1:]
pulls = json.loads(pathlib.Path(os.environ["TEST_PULLS"]).read_text())
if "PATCH" in args:
    endpoint = args[args.index("PATCH") + 1]
    payload = json.loads(pathlib.Path(args[args.index("--input") + 1]).read_text())
    with open(os.environ["TEST_PATCHES"], "a") as output:
        output.write(json.dumps({"endpoint": endpoint, **payload}) + "\\n")
elif "--paginate" in args:
    for pull in pulls:
        if pull["state"] == "open" and pull["user"] == {"login": "dependabot[bot]", "type": "Bot"}:
            print(pull["number"])
else:
    number = int(args[1].rsplit("/", 1)[1])
    print(json.dumps(next(pull for pull in pulls if pull["number"] == number)))
"""
    )
    executable.chmod(0o755)

    def run(pulls, *, event_name="pull_request_target", number=19):
        fixtures.write_text(json.dumps(pulls))
        event.write_text(json.dumps({"pull_request": {"number": number}}))
        result = subprocess.run(
            ["bash", "-c", SCRIPT],
            cwd=tmp_path,
            env={
                **os.environ,
                "PATH": f"{tmp_path}:{os.environ['PATH']}",
                "TEST_PULLS": str(fixtures),
                "TEST_PATCHES": str(patches),
                "GITHUB_REPOSITORY": "example/workspace",
                "GITHUB_EVENT_NAME": event_name,
                "GITHUB_EVENT_PATH": str(event),
                "RUNNER_TEMP": str(tmp_path),
            },
            capture_output=True,
            text=True,
            check=False,
        )
        changes = (
            [json.loads(line) for line in patches.read_text().splitlines()]
            if patches.exists()
            else []
        )
        return result, changes

    return run


@pytest.mark.parametrize(
    "footer",
    [
        "<details>\n<summary>Changelog</summary>\n<p>Release notes</p>\n</details>",
        "\n[![Dependabot compatibility score](badge)](link)\n\nDependabot will resolve conflicts.",
        "\nDependabot will resolve conflicts.\n\n<details>Commands</details>",
    ],
)
def test_removes_generated_sections(invoke, footer):
    summary = "Bumps [example](https://example.com) from 1.0 to 1.1."
    result, changes = invoke([pull(19, summary + "\n" + footer)])
    assert result.returncode == 0, result.stderr
    assert changes == [
        {"endpoint": "repos/example/workspace/pulls/19", "body": summary}
    ]


def test_preserves_grouped_versions_and_treats_summary_as_data(invoke, tmp_path):
    summary = "Bumps two packages: $(touch injected) and `other`.\n\n| Package | From | To |\n| a | 1 | 2 |"
    result, changes = invoke([pull(19, summary + "\n<details>Changelog</details>")])
    assert result.returncode == 0, result.stderr
    assert changes[0]["body"] == summary
    assert not (tmp_path / "injected").exists()


@pytest.mark.parametrize(
    "metadata",
    [
        {"login": "human"},
        {"login": "dependabot[bot]", "user_type": "User"},
        {"state": "closed"},
    ],
)
def test_refuses_other_authors_and_closed_prs(invoke, metadata):
    result, changes = invoke(
        [pull(19, "Summary\n<details>Notes</details>", **metadata)]
    )
    assert result.returncode == 0, result.stderr
    assert changes == []


def test_manual_run_processes_existing_dependabot_prs(invoke):
    result, changes = invoke(
        [
            pull(19, "First\n<details>Notes</details>"),
            pull(20, "Human", login="human"),
            pull(21, "Second\n"),
        ],
        event_name="workflow_dispatch",
    )
    assert result.returncode == 0, result.stderr
    assert [change["body"] for change in changes] == ["First", "Second"]


def test_leaves_clean_descriptions_unchanged(invoke):
    result, changes = invoke([pull(19, "A maintained dependency summary.")])
    assert result.returncode == 0, result.stderr
    assert changes == []


def test_fails_instead_of_writing_an_empty_description(invoke):
    result, changes = invoke([pull(19, "<details>Notes</details>")])
    assert result.returncode != 0
    assert "no dependency summary" in result.stderr
    assert changes == []


def test_write_job_filters_dependabot_events_and_executes_no_checkout():
    job = CONFIG["jobs"]["format"]
    assert CONFIG["permissions"] == {}
    assert job["permissions"] == {"pull-requests": "write"}
    assert "github.event.pull_request.user.login == 'dependabot[bot]'" in job["if"]
    assert "github.event.sender.login == 'dependabot[bot]'" in job["if"]
    assert all("uses" not in step for step in job["steps"])
    assert "${{" not in SCRIPT
