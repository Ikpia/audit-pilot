import { spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const port = Number(process.env.MCP_HTTP_PORT ?? 8787);
const url = `http://127.0.0.1:${port}/mcp`;

function waitForHealth() {
  return new Promise<void>((resolve, reject) => {
    const started = Date.now();

    async function check() {
      try {
        const response = await fetch(`http://127.0.0.1:${port}/health`);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // Keep polling until timeout.
      }

      if (Date.now() - started > 10_000) {
        reject(new Error("Timed out waiting for MCP HTTP server health check"));
        return;
      }

      setTimeout(check, 250);
    }

    void check();
  });
}

async function main() {
  const child = spawn(process.execPath, ["--import", "tsx", "src/mcp/http-server.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, MCP_HTTP_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });

  child.stdout.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr.on("data", (chunk) => process.stderr.write(chunk));

  try {
    await waitForHealth();

    const client = new Client({ name: "auditpilot-http-smoke", version: "0.1.0" });
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      requestInit: process.env.MCP_AUTH_TOKEN
        ? { headers: { Authorization: `Bearer ${process.env.MCP_AUTH_TOKEN}` } }
        : undefined
    });

    await client.connect(transport);
    const tools = await client.listTools();
    console.log(`HTTP_TOOLS=${tools.tools.map((tool) => tool.name).join(",")}`);

    const checklist = await client.callTool({
      name: "get_vulnerability_checklist",
      arguments: { chain: "solidity" }
    });
    console.log(`HTTP_CHECKLIST_OK=${JSON.stringify(checklist.content).includes("Reentrancy")}`);

    await client.close();
  } finally {
    child.kill();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
