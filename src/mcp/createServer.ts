import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getVulnerabilityChecklist } from "../../lib/audit/checklists";
import { parseLocalContractRepository } from "../../lib/audit/localParser";
import { parseContractRepository } from "../../lib/audit/parser";
import { getAuditPilotCapabilities } from "../../lib/config/capabilities";
import { searchSoloditFindings } from "../../lib/research/soloditClient";

type CreateAuditPilotMcpServerOptions = {
  enableLocalParsing?: boolean;
};

export function createAuditPilotMcpServer(options: CreateAuditPilotMcpServerOptions = {}) {
  const { enableLocalParsing = true } = options;
  const server = new McpServer({
    name: "auditpilot",
    version: "0.1.0",
    description:
      "AuditPilot is a deterministic MCP toolkit for smart contract auditing agents. It parses Solidity and Solana/Anchor repositories, returns vulnerability checklists, and looks up historical Solodit findings. The connected agent performs the vulnerability reasoning in its own session using its own model access."
  });

  if (enableLocalParsing) {
    server.registerTool(
      "parse_local_contract",
      {
        title: "Parse local smart contract repository",
        description:
          "Read an already-cloned local repository from this machine, detect whether it is Solidity or Solana/Anchor, and return raw parsed ContractUnit JSON including file paths, unit names, source code snippets, external-call signals, and metadata. This avoids cloning or GitHub API usage. It does not produce audit findings and does not call an LLM; the calling agent must reason over the returned units itself. Use this only with a local stdio MCP server that can access the target filesystem.",
        inputSchema: {
          repoPath: z.string().min(1).describe("Absolute or relative path to an already-cloned local repository")
        }
      },
      async ({ repoPath }) => {
        const parsed = await parseLocalContractRepository(repoPath);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(parsed, null, 2)
            }
          ]
        };
      }
    );
  }

  server.registerTool(
    "clone_and_parse_contract",
    {
      title: "Clone and parse smart contract repository",
      description:
        "Fetch a GitHub repository, detect whether it is Solidity or Solana/Anchor, and return raw parsed ContractUnit JSON including file paths, unit names, source code snippets, external-call signals, and metadata. This tool is useful for remote MCP clients or repositories that are not already cloned locally. It does not produce audit findings and does not call an LLM; the calling agent must reason over the returned units itself.",
      inputSchema: {
        repoUrl: z.string().url().describe("Public GitHub repository URL to parse")
      }
    },
    async ({ repoUrl }) => {
      const parsed = await parseContractRepository(repoUrl);

      return {
        content: [
          {
            type: "text" as const,
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
          type: "text" as const,
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
            type: "text" as const,
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

  return server;
}
