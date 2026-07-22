import "dotenv/config";
import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { createAuditPilotMcpServer } from "./createServer";

type AuditPilotServer = ReturnType<typeof createAuditPilotMcpServer>;

type McpSession = {
  server: AuditPilotServer;
  transport: StreamableHTTPServerTransport;
};

const sessions = new Map<string, McpSession>();
const port = Number(process.env.MCP_HTTP_PORT ?? process.env.PORT ?? 8787);

function setCorsHeaders(res: ServerResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,DELETE,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type, Last-Event-ID, MCP-Protocol-Version, Mcp-Session-Id"
  );
  res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id, MCP-Protocol-Version");
}

function sendJson(res: ServerResponse, statusCode: number, body: unknown) {
  setCorsHeaders(res);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function isAuthorized(req: IncomingMessage) {
  const expectedToken = process.env.MCP_AUTH_TOKEN;
  if (!expectedToken) {
    return true;
  }

  return req.headers.authorization === `Bearer ${expectedToken}`;
}

async function readJsonBody(req: IncomingMessage) {
  const chunks: Buffer[] = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) {
    return undefined;
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : undefined;
}

function hasInitializeRequest(body: unknown) {
  if (Array.isArray(body)) {
    return body.some((message) => isInitializeRequest(message));
  }

  return isInitializeRequest(body);
}

async function closeSession(sessionId: string) {
  const session = sessions.get(sessionId);
  if (!session) {
    return;
  }

  sessions.delete(sessionId);
  await session.transport.close();
  await session.server.close();
}

async function handleMcp(req: IncomingMessage, res: ServerResponse) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (!isAuthorized(req)) {
    sendJson(res, 401, { error: "Unauthorized" });
    return;
  }

  if (!["GET", "POST", "DELETE"].includes(req.method ?? "")) {
    sendJson(res, 405, { error: "Method not allowed" });
    return;
  }

  const sessionId = req.headers["mcp-session-id"];
  const sessionKey = Array.isArray(sessionId) ? sessionId[0] : sessionId;

  if (req.method === "DELETE") {
    if (sessionKey) {
      await closeSession(sessionKey);
    }
    res.statusCode = 204;
    res.end();
    return;
  }

  let body: unknown;
  if (req.method === "POST") {
    try {
      body = await readJsonBody(req);
    } catch {
      sendJson(res, 400, { error: "Invalid JSON request body" });
      return;
    }
  }

  let session = sessionKey ? sessions.get(sessionKey) : undefined;

  if (!session) {
    if (req.method !== "POST" || !hasInitializeRequest(body)) {
      sendJson(res, 400, { error: "No valid MCP session. Send an initialize request first." });
      return;
    }

    const server = createAuditPilotMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID()
    });

    session = { server, transport };
    transport.onclose = () => {
      const activeSessionId = transport.sessionId;
      if (activeSessionId) {
        sessions.delete(activeSessionId);
      }
      void server.close().catch((error) => console.error("Failed to close MCP server", error));
    };

    await server.connect(transport);
    await transport.handleRequest(req, res, body);

    if (transport.sessionId) {
      sessions.set(transport.sessionId, session);
    }
    return;
  }

  await session.transport.handleRequest(req, res, body);
}

const httpServer = createServer((req, res) => {
  const pathname = new URL(req.url ?? "/", "http://localhost").pathname;

  if (pathname === "/health") {
    sendJson(res, 200, {
      ok: true,
      service: "auditpilot-mcp",
      transport: "streamable-http",
      sessions: sessions.size
    });
    return;
  }

  if (pathname === "/" || pathname === "/mcp-info") {
    sendJson(res, 200, {
      name: "auditpilot",
      mcpEndpoint: "/mcp",
      tools: ["clone_and_parse_contract", "get_vulnerability_checklist", "search_solodit_findings"]
    });
    return;
  }

  if (pathname !== "/mcp") {
    sendJson(res, 404, { error: "Not found" });
    return;
  }

  void handleMcp(req, res).catch((error) => {
    console.error(error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Internal MCP server error" });
      return;
    }
    res.end();
  });
});

httpServer.listen(port, () => {
  console.error(`AuditPilot MCP HTTP server listening on port ${port}`);
});
