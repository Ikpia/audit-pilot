import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function main() {
  const client = new Client({ name: "auditpilot-smoke", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["--import", "tsx", "src/mcp/server.ts"],
    cwd: process.cwd(),
    stderr: "pipe"
  });

  transport.stderr?.on("data", (chunk) => process.stderr.write(chunk));

  await client.connect(transport);
  const tools = await client.listTools();
  console.log(`TOOLS=${tools.tools.map((tool) => tool.name).join(",")}`);

  const checklist = await client.callTool({
    name: "get_vulnerability_checklist",
    arguments: { chain: "solidity" }
  });
  console.log(`CHECKLIST_OK=${JSON.stringify(checklist.content).includes("Reentrancy")}`);

  const solodit = await client.callTool({
    name: "search_solodit_findings",
    arguments: { keywords: "reentrancy external call", languages: ["solidity"], tags: ["reentrancy"] }
  });
  console.log(`SOLODIT_OK=${Array.isArray(solodit.content)}`);

  const parsed = await client.callTool({
    name: "clone_and_parse_contract",
    arguments: { repoUrl: "https://github.com/foundry-rs/forge-std" }
  });
  console.log(`PARSE_OK=${JSON.stringify(parsed.content).includes("units")}`);

  await client.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});