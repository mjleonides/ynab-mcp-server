# YNAB MCP Server

An authenticated HTTP/SSE Model Context Protocol (MCP) server for YNAB.

The server defaults to a read-only Docker deployment. Set `READ_ONLY=true` to
exclude every tool that can modify a YNAB budget.

## Requirements

- Node.js 18 or later for local development
- A [YNAB personal access token](https://api.ynab.com/#personal-access-tokens)
- Docker and Docker Compose for container deployment

## Configuration

| Variable | Required | Description |
| --- | --- | --- |
| `YNAB_API_TOKEN` | Yes | YNAB personal access token. |
| `MCP_AUTH_TOKEN` | Yes | Static bearer token required by MCP endpoints. Generate one with `openssl rand -hex 32`. |
| `READ_ONLY` | No | Set to `true` to disable mutation tools. Mutations are enabled when unset or any other value. |
| `YNAB_BUDGET_ID` | No | Default YNAB budget ID. |
| `HOST` | No | HTTP bind address. Defaults to `0.0.0.0`. |
| `PORT` | No | HTTP listen port. Defaults to `3000`. |

Keep both tokens private. The server fails at startup if `MCP_AUTH_TOKEN` is missing.

## Docker Deployment

1. Create a local environment file from the example:

```bash
cp .env.example .env
```

2. Set `YNAB_API_TOKEN` and a high-entropy `MCP_AUTH_TOKEN` in `.env`.

3. Start the server:

```bash
docker compose up --build
```

The included Compose configuration publishes port `3000` and sets `READ_ONLY=true`.
To permit mutations, change that setting in `docker-compose.yml` or supply your
own Compose override.

## Local Development

Install dependencies and build the server:

```bash
npm install
npm run build
```

Run it with the required authentication and YNAB credentials:

```bash
MCP_AUTH_TOKEN="$(openssl rand -hex 32)" YNAB_API_TOKEN="your-ynab-token" READ_ONLY=true npm start
```

Run the checks:

```bash
npm test -- --run
npm run build
```

## MCP Transport

This server implements the legacy MCP HTTP/SSE transport:

| Endpoint | Authentication | Purpose |
| --- | --- | --- |
| `GET /sse` | Required | Establishes the server-sent events stream. |
| `POST /message?sessionId=<session-id>` | Required | Sends JSON-RPC messages for the SSE session. |
| `GET /healthz` | Not required | Returns `200 OK` for container health checks. |

Send this header to both MCP endpoints:

```http
Authorization: Bearer <MCP_AUTH_TOKEN>
```

After opening `/sse`, the transport emits the message endpoint containing its
session ID. Clients must include that `sessionId` query parameter when posting
JSON-RPC messages.

For example, an authenticated SSE connection can be opened with:

```bash
curl -N -H "Authorization: Bearer $MCP_AUTH_TOKEN" http://localhost:3000/sse
```

## Tools

The following read-only tools are always registered:

- `ynab_list_budgets`
- `ynab_get_unapproved_transactions`
- `ynab_budget_summary`
- `ynab_list_payees`
- `ynab_get_transactions`
- `ynab_list_categories`
- `ynab_list_accounts`
- `ynab_list_scheduled_transactions`
- `ynab_list_months`

These mutation tools are registered only when `READ_ONLY` is unset or is not
exactly `true`:

- `ynab_create_transaction`
- `ynab_approve_transaction`
- `ynab_update_category_budget`
- `ynab_update_transaction`
- `ynab_bulk_approve_transactions`
- `ynab_delete_transaction`
- `ynab_import_transactions`

## Adding Tools

Each tool module in `src/tools/` exports a name, description, Zod input schema,
and `execute` function. Register it in `src/server.ts`, keeping read-only tools
outside the `if (!isReadOnly)` block and mutation tools inside it.

```typescript
import * as MyTool from "./tools/MyTool.js";

server.registerTool(MyTool.name, {
  title: "My Tool",
  description: MyTool.description,
  inputSchema: MyTool.inputSchema,
}, async (input) => MyTool.execute(input, api));
```

Add corresponding tests under `src/tests/` and run the local checks before
opening a pull request.

## CI

Pull requests targeting `main` run the Vitest suite on Node.js 22 and 24. A
separate GitHub Actions workflow also builds the Docker image, validating the
container packaging without publishing an image.
