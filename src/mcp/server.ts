import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { getVulnerabilityChecklist } from "../../lib/audit/checklists";
import { parseContractRepository } from "../../lib/audit/parser";
import { getAuditPilotCapabilities } from "../../lib/config/capabilities";
import { searchSoloditFindings } from "../../lib/research/soloditClient";

const server = new McpServer({
  name: "auditpilot",
  version: "0.1.0",
  description:
    "AuditPilot is a deterministic MCP toolkit for smart contract auditing agents. It parses Solidity and Solana/Anchor repositories, returns vulnerability checklists, and looks up historical Solodit findings. The connected agent performs the vulnerability reasoning in its own session using its own model access."
});

server.registerTool(
  "clone_and_parse_contract",
  {
    title: "Clone and parse smart contract repository",
    description:
      "Fetch a GitHub repository, detect whether it is Solidity or Solana/Anchor, and return raw parsed ContractUnit JSON including file paths, unit names, source code snippets, external-call signals, and metadata. This tool does not produce audit findings and does not call an LLM; the calling agent must reason over the returned units itself.",
    inputSchema: {
      repoUrl: z.string().url().describe("Public GitHub repository URL to parse")
    }
  },
  async ({ repoUrl }) => {
    const parsed = await parseContractRepository(repoUrl);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(parsed, null, 2)
        }
      ]
    };
  }
);

server.registerTool(
  "get_vulnerability_checklist",
  {
    title: "Get vulnerability checklist",
    description:
      "Return a deterministic checklist of vulnerability categories the calling agent should consider for the selected chain. This is only guidance for the agent's own analysis; it does not inspect code and does not call an LLM.",
    inputSchema: {
      chain: z.enum(["solidity", "solana"]).describe("Smart contract ecosystem to retrieve checks for")
    }
  },
  async ({ chain }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            chain,
            checklist: getVulnerabilityChecklist(chain)
          },
          null,
          2
        )
      }
    ]
  })
);

server.registerTool(
  "search_solodit_findings",
  {
    title: "Search historical Solodit findings",
    description:
      "Search the configured Solodit/Cyfrin findings API for historical vulnerability precedent. This is a deterministic HTTP lookup with no LLM call; the calling agent decides which keywords to search and how to use the returned findings for grounding.",
    inputSchema: {
      keywords: z.string().min(1).describe("Vulnerability keywords or short issue description"),
      languages: z.array(z.string()).optional().describe("Optional languages such as solidity or rust"),
      tags: z.array(z.string()).optional().describe("Optional vulnerability tags to blend into the search keywords")
    }
  },
  async ({ keywords, languages, tags }) => {
    const language = languages?.find((item) => item.toLowerCase() === "solidity" || item.toLowerCase() === "rust") as
      | "solidity"
      | "rust"
      | undefined;
    const findings = await searchSoloditFindings({
      query: [keywords, ...(tags ?? [])].join(" "),
      language,
      limit: 5
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({ findings }, null, 2)
        }
      ]
    };
  }
);

server.registerResource(
  "capabilities",
  "auditpilot://capabilities",
  {
    title: "AuditPilot capabilities",
    description: "Supported deterministic MCP tools, ecosystems, APIs, and environment flags.",
    mimeType: "application/json"
  },
  async () => ({
    contents: [
      {
        uri: "auditpilot://capabilities",
        mimeType: "application/json",
        text: JSON.stringify(getAuditPilotCapabilities(), null, 2)
      }
    ]
  })
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});