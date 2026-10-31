# Stress / load tests

A repeatable, multi-user load simulator for the backend + Workspace MCP, plus a launcher that
brings up the topology you want to test.

Run these load tests manually against a running stack. Pytest regression coverage is in `tests/test_bridge_load.py`, `tests/test_runtime_metrics.py`, and `tests/test_workspace_mcp_bridge.py`.

## Contents

| file | purpose |
|---|---|
| `run_stress.sh` | Starts a topology (database type and worker count) and runs the simulator |
| `load_simulator.py` | the load generator (realistic multi-user Workspace MCP traffic) |
| `../../../docker/docker-compose.stress.yml` | one parameterized overlay (workers + Prometheus), layered on a base stack |

## Prerequisites

- Docker + `docker compose`.
- A Python with `aiohttp` and `websockets` for the simulator. Run `uv sync --locked` in `backend/` to create `backend/.venv`, which the launcher uses automatically, or set `PYTHON=/path/to/python`. The `--down` and `--no-run` modes do not require host Python.
- Run from a bash shell (Git Bash on Windows).

## Quick start

```bash
cd backend/tests/stress

# MySQL, 3 workers, 80 users — the production-representative run
./run_stress.sh --db mysql --workers 3 --users 80

# SQLite, single worker, realistic small load — seed the DB on first run
./run_stress.sh --db sqlite --workers 1 --users 20 --seed

# MCP-impact A/B: hold API load fixed, add a pool of MCP-only hammerers
./run_stress.sh --db mysql --workers 3 --users 80 --mcp-users 0  --api-mcp 0   # baseline
./run_stress.sh --db mysql --workers 3 --users 80 --mcp-users 40 --api-mcp 0   # + MCP load

# Just bring a stack up (no load), or tear it down
./run_stress.sh --db sqlite --workers 1 --no-run
./run_stress.sh --db mysql --down
```

## Flags

| flag | default | meaning |
|---|---|---|
| `--db` | `mysql` | `mysql` or `sqlite` |
| `--workers` | `1` | uvicorn worker processes |
| `--users` | `40` | simulated API users |
| `--duration` | `20` | seconds |
| `--ramp` | `5` | stagger user arrival over this many seconds (avoids a thundering herd) |
| `--mcp-users` | `0` | extra MCP-only users layered on top (for measuring MCP's impact on the API) |
| `--api-mcp` | `1` | `0` excludes MCP calls from simulated API traffic. Use this for the comparison above |
| `--seed` | off | run `init_users` to create the admin user (needed once on a fresh DB) |
| `--no-run` | off | bring the stack up but skip the simulator |
| `--down` | off | tear the stack down and exit |

The simulator authenticates as `admin@openbb.co` / `asdQWE123!` (override with `ADMIN_EMAIL` /
`ADMIN_PASSWORD` env). It needs the frontend User-Agent to skip rate limiting. This defaults to
`test` (the value in the development environments); override with `FRONTEND_UA` if your env differs.

## What it does

Each simulated user logs in, opens a bridge WebSocket (an auto-answering "browser tab"), and loops a
weighted mix of real endpoints: `validate-and-sync` (once, the dashboard-open aggregation),
`dash/sync` (save), the read endpoints (`api-source`, `apps`, `shared`, `resource-permissions`),
`display-settings`, and Workspace MCP tool calls over `/mcp`. A `--mcp-users` pool can add MCP-only
load to isolate the MCP server's impact on the rest of the API.

## Reading the output

The simulator prints, per action: count, `ok%`, p50/p95 latency, and HTTP status distribution.
Then it reports the live runtime gauges scraped from `/metrics`:

- `db_pool_connections`: checked-out connections per engine pool (not applicable to SQLite, which uses `StaticPool`).
- `threadpool_tokens`: worker thread-pool occupancy.
- `event_loop_lag_seconds`: event-loop scheduling delay, used to identify blocking operations.

## Notes / gotchas

- MySQL and SQLite stacks share container names (`fastapi`, `redis`), so the launcher tears down
  any existing stack before starting. Only one runs at a time.
- SQLite is single-writer. `--db sqlite --workers >1` will produce `database is locked` errors
  under write load. Use `--workers 1` for SQLite.
