# AI Matters

An AI-powered matter intelligence application for iManage Work. Phase 1 connects to the
official **iManage Work MCP Server**, authenticates with OAuth 2.0 + PKCE, and lets users
browse and search their iManage workspaces through a shadcn/ui interface.

AI analysis, document retrieval, and metadata extraction are **not** implemented yet — see
"Next phase" below.

## Stack

- **Frontend**: React 19 + TypeScript, Vite, Tailwind CSS v4, shadcn/ui, TanStack Query, React Router
- **Backend**: Node.js + TypeScript (Express 5), the official `@modelcontextprotocol/sdk`, `express-session`
- **Protocol**: Model Context Protocol (Streamable HTTP) with OAuth 2.0 Authorization Code + PKCE and
  Dynamic Client Registration

## Architecture

```text
React + Vite + shadcn/ui  --(same-origin /api, via Vite proxy)-->  Express backend  --(MCP SDK, OAuth)-->  iManage Work MCP Server
```

The browser never talks to iManage directly and never holds an access token or client secret —
only an httpOnly session cookie. The backend owns the OAuth dance and the MCP client connection,
and exposes a narrow, read-only application API:

```text
GET    /api/mcp/status          Connection state, environment, discovered tool availability
GET    /api/mcp/tools           Metadata for the discovered workspace-related tools
GET    /api/auth/connect        Starts the OAuth flow (redirect)
GET    /api/auth/callback       Completes the OAuth flow (redirect)
POST   /api/auth/disconnect     Clears the session's iManage tokens and closes the MCP connection
GET    /api/workspaces/recent   get_recent_workspaces, normalized
GET    /api/workspaces/search   search_workspaces, normalized (?q=&libraryId=)
GET    /api/libraries           get_libraries, if the tenant enables it
```

See `server/src/` for the implementation: `mcp/` (connection, tool discovery/argument mapping,
response normalization), `auth/` (session-backed `OAuthClientProvider`), `routes/`.

## Prerequisites

- Node.js 18+
- OpenSSL (for local HTTPS) — iManage requires an HTTPS redirect URI, even in development.
  [mkcert](https://github.com/FiloSottile/mkcert) is used automatically if it's on your PATH, which
  avoids a browser certificate warning.

## Setup

```bash
# 1. Generate a local dev TLS certificate (one-time)
npm run setup:certs

# 2. Install dependencies
npm install
npm --prefix server install

# 3. Configure the backend
cp server/.env.example server/.env
# Edit server/.env: set IMANAGE_MCP_URL to your tenant (or leave the default
# https://cloudimanage.com/mcp/work), and generate a SESSION_SECRET:
#   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# 4. Start a local PostgreSQL (native install, or via Docker):
docker compose up -d postgres
# then create the database/role matching server/.env.example's defaults, and apply migrations:
npm --prefix server run db:migrate

# 5. Run both the frontend and backend
npm run dev:all
```

Then open **https://localhost:5173**. The first time, your browser will warn about the
self-signed certificate (unless you have mkcert installed) — accept it to continue.

Run them separately if you prefer: `npm run dev` (frontend) and `npm run dev:server` (backend).

### iManage administrator prerequisites

Before a real connection can succeed, an iManage administrator must, in Control Center:

- Add/enable the **iManage MCP Control Center Extension** and **iManage MCP Service** applications.
- Add **AI Matters** as an allowed MCP client, and approve its OAuth redirect URI
  (`OAUTH_REDIRECT_URL` in `server/.env`).
- Grant the authenticated user's MCP policy access to the `search_workspaces` and
  `get_recent_workspaces` read tools (and optionally `get_libraries`).

If any of these are missing, AI Matters surfaces a specific "authentication required" or
"permission denied" state rather than a generic failure.

## Testing

```bash
npm test                     # frontend unit tests (Vitest + Testing Library)
npm --prefix server test     # backend unit tests (Vitest + Supertest, mocked MCP responses)
npm run lint                 # ESLint
npm run build                # frontend typecheck + production build
npm --prefix server run build  # backend typecheck + compile
```

## Project structure

```text
src/
  components/
    layout/       AppShell, sidebar navigation
    workspaces/   Toolbar, data table, connect prompt, status badge
    ui/           shadcn/ui primitives (generated — not hand-maintained)
  pages/          WorkspacesPage, WorkspaceDetailPage, SettingsPage
  hooks/          useMcpConnection, useWorkspaces, useLibraries (TanStack Query)
  services/       api.ts (fetch wrapper), workspaceService, mcpService, libraryService
  context/        WorkspaceCacheContext (in-memory lookup for the detail view)
  types/          Workspace, McpStatus, Library

server/src/
  mcp/            connection.ts (session-scoped MCP client cache), tools.ts (schema-driven
                  argument mapping), workspaceMapper.ts / libraryMapper.ts (response
                  normalization), errors.ts
  auth/           oauthProvider.ts (session-backed OAuthClientProvider), session.ts, jwt.ts
  routes/         auth.ts, mcp.ts, workspaces.ts, libraries.ts
```

## Phase 4: PostgreSQL persistence

Matters, Matter Knowledge Markdown (versioned), Matter Profile fields, and classification
results are persisted in PostgreSQL (`server/src/database/`, Drizzle ORM) — shared per
workspace across sessions, not a per-browser-session silo. See `infra/README.md` for the
Azure Database for PostgreSQL Flexible Server setup (Entra-only auth, no passwords) and the
one-time bootstrap step required after the first deployment. Local development uses a plain
password against a local Postgres instance (native install or `docker-compose.yml`).

## Production notes

This repo is configured for local development. Before deploying:

- Replace the in-memory Express session store (`server/src/auth/session.ts`) with a shared,
  persistent store (e.g. Redis via `connect-redis`).
- Replace the in-memory MCP connection cache (`server/src/mcp/connection.ts`) with something
  that survives process restarts and horizontal scaling, or accept reconnect-on-demand.
- Inject `SESSION_SECRET` from a secrets manager, not a committed `.env` file.
- Use a CA-issued TLS certificate instead of the local dev certificate.

## Next phase

Workspace selection (with its real iManage workspace ID) is already wired up as the foundation
for the next phase: searching a selected workspace's documents, AI-generated matter summaries,
and structured metadata extraction via additional MCP tools (`get_workspace_profile`,
`get_container_children`, `search`, `get_document_profile`, `fetch`) plus an LLM integration —
none of which are implemented yet.
