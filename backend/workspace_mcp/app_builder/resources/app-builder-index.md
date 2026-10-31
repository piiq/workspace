---
title: App Builder Index
uri: openbb://workspace/app-builder/index
use_when: You are about to build, review, debug, or extend an OpenBB Workspace app and need to find the right resource to read next.
language_specific: false
related:
  - openbb://workspace/overview/what-is-workspace
  - openbb://workspace/overview/ai-agent-contract
  - openbb://workspace/contract/backend
  - openbb://workspace/specs/widgets-json
  - openbb://workspace/specs/apps-json
  - openbb://workspace/guides/build-an-app
---

# OpenBB Workspace App Builder

OpenBB Workspace apps use HTTP backends and JSON metadata. Use any language or framework that serves the required endpoints and responses. Most examples use Python and FastAPI.

## How to use this resource set

Start with the two overview docs to understand Workspace and its users. Then read the backend interface, the spec for the file you are editing, and the relevant guide. Consult examples as needed.

| Task | Read |
|-------------------|------|
| Understand Workspace | `openbb://workspace/overview/what-is-workspace` |
| Make widgets usable by the AI Agent | `openbb://workspace/overview/ai-agent-contract` |
| Understand what a backend must expose | `openbb://workspace/contract/backend` |
| Author or edit `widgets.json` | `openbb://workspace/specs/widgets-json` + `openbb://workspace/specs/widget-types` + `openbb://workspace/specs/widget-parameters` |
| Author or edit `apps.json` | `openbb://workspace/specs/apps-json` + `openbb://workspace/specs/layout-grid` |
| Build a brand-new app | `openbb://workspace/guides/build-an-app` |
| Review someone else's app | `openbb://workspace/guides/review-app` + `openbb://workspace/validation/common-errors` |
| Debug an app that doesn't load | `openbb://workspace/guides/debug-app` + `openbb://workspace/validation/common-errors` |
| Wrap an existing HTTP endpoint as a widget | `openbb://workspace/guides/convert-endpoint-to-widget` |
| Want a framework-neutral picture of the backend | `openbb://workspace/examples/generic-http/minimal` |
| Want the recommended Python starter | `openbb://workspace/examples/python-fastapi/minimal` |

## Reminders

- The backend is HTTP-only. Workspace never imports your code.
- `widgets.json` is a JSON object keyed by widget id. Not an array.
- `apps.json` is a JSON array of app objects. Not an object.
- Layout uses `i` for the widget id, not `id`.
- Prefer `Group 1`, `Group 2`, ... names for parameter groups; put human-readable meaning in descriptions/categories.
- A schema-valid app still needs a semantic output pass: verify default aggregates, parameter scenarios, units, table columns, and chart state columns.
- Try to ship app thumbnails via `img`, `img_dark`, and `img_light`; a small backend-served SVG is enough.
- FastAPI is one option. Use whatever fits the project.

## Out of scope here

Read the matching specification for field definitions.
