import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

async function createSolidityFixture() {
  const repoPath = await mkdtemp(path.join(os.tmpdir(), "auditpilot-local-"));
  await mkdir(path.join(repoPath, "src"), { recursive: true });
  await writeFile(path.join(repoPath, "foundry.toml"), "[profile.default]\nsrc = 'src'\n");
  await writeFile(
    path.join(repoPath, "src", "Fixture.sol"),
    "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\ncontract Fixture { function ping() external pure returns (uint256) { return 1; } }\n"
  );
  return repoPath;
}

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

  const repoPath = await createSolidityFixture();

  try {
    const localParsed = await client.callTool({
      name: "parse_local_contract",
      arguments: { repoPath }
    });
    console.log(`LOCAL_PARSE_OK=${JSON.stringify(localParsed.content).includes("Fixture")}`);
  } finally {
    await rm(repoPath, { recursive: true, force: true });
  }

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
