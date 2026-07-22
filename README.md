# AuditPilot

AuditPilot is a Codex-native smart contract security agent for OpenAI Build Week.
It starts with Solidity and Solana/Anchor support, then normalizes both stacks into one audit pipeline that can be upgraded with GPT-5.6 tool-calling Solodit-style research grounding, and Codex-generated patches.

## What works now

- Next.js web app for submitting a GitHub repository URL.
- GitHub repository inspection through the REST API.
- Solidity and Solana/Anchor stack detection.
- Shared audit report schema with severity-ranked findings.
- A modular engine boundary ready for the full GPT-5.6 agent loop.

## Run locally

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

## Environment

Create `.env.local` with project configuration only. Do not commit real values.

```bash
GITHUB_TOKEN=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
API_KEY_ENCRYPTION_SECRET=
OPENAI_MODEL=gpt-5.6
AUDITPILOT_USE_AI=true
AUDITPILOT_ENABLE_WEB_SEARCH=true
SOLODIT_API_URL=https://solodit.cyfrin.io/api/v1/solodit
SOLODIT_API_KEY=
AUDITPILOT_USE_SOLODIT=false
```

Web audits use the signed-in user's encrypted OpenAI API key from Supabase, not a shared `OPENAI_API_KEY`. `GITHUB_TOKEN` is optional but recommended for higher GitHub API limits. `API_KEY_ENCRYPTION_SECRET` should be a long random secret and must stay stable or saved API keys cannot be decrypted.

## Supabase setup

1. Create a Supabase project.
2. In Supabase Auth providers, enable GitHub OAuth and configure the GitHub client ID/secret in the Supabase dashboard.
3. Add the callback URL Supabase shows you to the GitHub OAuth app.
4. Copy the project URL, anon key, and service role key into `.env.local`.
5. Run the SQL migration in `supabase/migrations/202607150001_auditpilot_auth_persistence.sql` from the Supabase SQL editor or Supabase CLI.
6. Restart the Next dev server.

The migration creates `api_keys` and `audit_runs`, enables RLS, and restricts each user to their own rows. API keys are encrypted server-side before insertion and decrypted only inside `POST /api/audit`.
## MCP

AuditPilot exposes a deterministic MCP server for Codex CLI, IDE agents, and ChatGPT developer mode. The MCP surface does **not** call OpenAI or produce a finished audit itself. It gives the connected agent raw contract context, checklists, and historical precedent; the agent reasons in its own session using the user's own model access and quota.

Start the server locally:

```bash
npm --silent run mcp
```

Use `--silent` for stdio clients so npm does not print banner text into the MCP JSON-RPC stream.

Available MCP tools:

- `clone_and_parse_contract`: accepts `{ "repoUrl": "https://github.com/org/repo" }` and returns parsed repository metadata plus `ContractUnit[]` with file paths, unit names, source code snippets, external-call signals, and metadata. It does not return audit findings.
- `get_vulnerability_checklist`: accepts `{ "chain": "solidity" }` or `{ "chain": "solana" }` and returns ecosystem-specific vulnerability categories for the calling agent to reason through.
- `search_solodit_findings`: accepts `{ "keywords": "...", "languages": ["solidity"], "tags": ["..."] }` and returns matching historical Solodit/Cyfrin findings for grounding. It is a deterministic HTTP lookup, not an LLM call.

Codex CLI config example:

```toml
[mcp_servers.auditpilot]
command = "npm"
args = ["--silent", "run", "mcp"]
cwd = "C:\\Users\\USER1\\Downloads\\Ubuntu\\anu\\hackaton\\audit-pilot"
```

See `docs/codex-mcp.example.toml` for the same config as a file.

ChatGPT developer mode connection:

1. Start the local MCP server with `npm --silent run mcp`, or deploy a remote MCP transport if your ChatGPT workspace requires remote servers.
2. In ChatGPT, open Settings -> Apps.
3. Choose the developer/local MCP server connection flow.
4. Add AuditPilot using the local command above or the deployed remote MCP server URL.
5. Ask ChatGPT to audit a contract repo. It should call `clone_and_parse_contract`, reason over the returned units itself, and optionally call `search_solodit_findings` for precedent.

## OpenAI Build Week Compliance

- Track: Developer Tools.
- Category fit: security tooling, agentic workflows, Solidity and Solana/Anchor developer productivity.
- Required platform usage: AuditPilot was built with Codex and uses GPT-5.6 in the web audit path when a signed-in user provides their own OpenAI API key. The MCP path is intentionally deterministic so Codex, ChatGPT, or an IDE agent reasons in the user's own session and quota.
- Working project: Next.js web app, Supabase GitHub OAuth, encrypted BYOK storage, persisted audit history, and a stdio MCP server.
- Supported platforms: local Next.js web app, Codex CLI/IDE MCP clients, and ChatGPT MCP/developer-mode clients.
- Testing path for judges: run the web app locally with Supabase env vars, or run `npx tsx scripts\mcp-smoke.ts` to test the MCP developer-tool surface without configuring Supabase.
- Repository licensing: MIT License included in `LICENSE` for public judging/testing.

## Devpost Submission Checklist

- Public YouTube demo video under 3 minutes with audio.
- Demo must show the product working and explicitly explain how Codex and GPT-5.6 were used.
- Code repository URL must be public with this license, or private and shared with `testing@devpost.com` and `build-week-event@openai.com`.
- README must include setup and testing instructions; this file covers web app, Supabase, MCP, and smoke-test setup.
- Include the `/feedback` Codex Session ID for the project thread where the majority of core functionality was built.
- Include the category `Developer Tools` in the Devpost submission.
- Provide a live demo URL, sandbox, test account, or clear local/MCP smoke-test path for judging.
## API surfaces

- `POST /api/audit` runs an audit from the web app or any HTTP client.
- `GET /api/capabilities` reports enabled integrations and required env vars.
- `npm --silent run mcp` starts the stdio MCP server for Codex-compatible clients.
## Test MCP With forge-std

You can test AuditPilot's MCP surface locally with the public Forge standard-library repository: <https://github.com/foundry-rs/forge-std>.

### 1. Clone AuditPilot

```bash
git clone <your-auditpilot-repo-url>
cd audit-pilot
npm install
```

### 2. Configure Optional MCP Env

Create `.env` or `.env.local` in the project root. OpenAI is **not** required for MCP because Codex does the reasoning in the user's own session.

```bash
GITHUB_TOKEN=optional_github_token_for_higher_rate_limits
SOLODIT_API_URL=https://solodit.cyfrin.io/api/v1/solodit
SOLODIT_API_KEY=optional_solodit_key
CYFRIN_API_KEY=optional_solodit_key
AUDITPILOT_USE_SOLODIT=true
```

If `GITHUB_TOKEN` is omitted, public GitHub parsing still works until GitHub's unauthenticated rate limit is reached.

### 3. Smoke-Test The MCP Server

```bash
npx tsx scripts\mcp-smoke.ts
```

Expected output:

```text
TOOLS=clone_and_parse_contract,get_vulnerability_checklist,search_solodit_findings
CHECKLIST_OK=true
SOLODIT_OK=true
PARSE_OK=true
```

### 4. Add AuditPilot To Codex

Add this to your Codex config file, usually `~/.codex/config.toml` on macOS/Linux or `C:\Users\<you>\.codex\config.toml` on Windows:

```toml
[mcp_servers.auditpilot]
command = "npm"
args = ["--silent", "run", "mcp"]
cwd = "C:\\absolute\\path\\to\\audit-pilot"
```

On this machine the local path is:

```toml
[mcp_servers.auditpilot]
command = "npm"
args = ["--silent", "run", "mcp"]
cwd = "C:\\Users\\USER1\\Downloads\\Ubuntu\\anu\\hackaton\\audit-pilot"
```

Restart Codex after editing the config.

### 5. Ask Codex To Audit forge-std

In Codex, ask:

```text
Use the AuditPilot MCP server to audit https://github.com/foundry-rs/forge-std
```

Expected behavior:

1. Codex calls `clone_and_parse_contract` to parse the repo as Solidity.
2. Codex calls `get_vulnerability_checklist` for Solidity audit categories.
3. Codex optionally calls `search_solodit_findings` for historical precedent.
4. Codex reasons over the returned data in its own session and produces findings.

AuditPilot MCP intentionally returns raw parsed data and references, not a finished LLM-generated audit. That keeps model usage on the developer's own Codex/OpenAI account.

## Deploy MCP On Railway

AuditPilot's local MCP server uses stdio for Codex on your own machine. Railway needs an HTTP process, so this repo also includes a Streamable HTTP MCP entrypoint at `src/mcp/http-server.ts`.

Railway uses `railway.json` and starts the MCP server with:

```bash
npm run mcp:http
```

The deployed endpoints are:

- `/mcp`: Streamable HTTP MCP endpoint for remote MCP clients.
- `/health`: Railway health check endpoint.
- `/mcp-info`: Small JSON info page listing the exposed tool names.

### Railway Deployment Steps

1. Push this repository to GitHub.
2. In Railway, create a new project from the GitHub repo.
3. Let Railway use the included `railway.json`; it will run `npm run mcp:http`.
4. Add environment variables in Railway:

```bash
GITHUB_TOKEN=
SOLODIT_API_URL=https://solodit.cyfrin.io/api/v1/solodit
SOLODIT_API_KEY=
CYFRIN_API_KEY=
AUDITPILOT_USE_SOLODIT=true
MCP_AUTH_TOKEN=
```

`PORT` is set automatically by Railway. `MCP_AUTH_TOKEN` is optional; if you set it, clients must send `Authorization: Bearer <token>` when calling `/mcp`. Do not add an OpenAI key to the MCP deployment. The MCP server is deterministic and the connected Codex or ChatGPT session does the reasoning with its own model access.

5. After deployment, open:

```text
https://your-railway-domain.up.railway.app/health
```

You should see `{ "ok": true, "service": "auditpilot-mcp" }`.

6. Use this as the remote MCP URL in clients that support Streamable HTTP MCP:

```text
https://your-railway-domain.up.railway.app/mcp
```

If your Codex client only supports local stdio MCP, keep using the local config shown above. The Railway deployment is mainly for remote MCP clients such as ChatGPT developer mode or any MCP host that supports Streamable HTTP.

### Test The HTTP MCP Locally

Before deploying, run:

```bash
npm run mcp:smoke:http
```

Expected output:

```text
HTTP_TOOLS=clone_and_parse_contract,get_vulnerability_checklist,search_solodit_findings
HTTP_CHECKLIST_OK=true
```
