"""Remove findings marked by CodeQL's inline suppression queries before upload."""

import argparse
import json
from pathlib import Path


class Arguments(argparse.Namespace):
    sarif_files: list[Path]


def main() -> None:
    parser = argparse.ArgumentParser(
        description=__doc__,
        epilog="The SARIF files are updated in place; other results and metadata are preserved.",
    )
    parser.add_argument(
        "sarif_files", type=Path, nargs="+", help="CodeQL SARIF files to filter"
    )
    args = parser.parse_args(namespace=Arguments())
    for path in args.sarif_files:
        report = json.loads(path.read_text(encoding="utf-8"))
        removed = 0
        for run in report["runs"]:
            if "results" not in run:
                continue
            results = run["results"]
            run["results"] = [
                result
                for result in results
                if not any(
                    suppression.get("kind") == "inSource"
                    for suppression in result.get("suppressions", [])
                )
            ]
            removed += len(results) - len(run["results"])
        path.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(f"{path}: removed {removed} inline-suppressed findings.")


if __name__ == "__main__":
    main()
