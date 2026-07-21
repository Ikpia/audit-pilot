import type { AuditFinding, ContractUnit, SmartContractEcosystem } from "../audit/types";

type OpenAIResearchInput = {
  ecosystem: SmartContractEcosystem;
  units: ContractUnit[];
  seedFindings: AuditFinding[];
};

type OpenAIResearchOptions = {
  apiKey?: string;
  enabled?: boolean;
};

export async function runOpenAIResearch(
  input: OpenAIResearchInput,
  options: OpenAIResearchOptions = {}
) {
  const apiKey = options.apiKey || process.env.OPENAI_API_KEY;
  const enabled = options.enabled ?? process.env.AUDITPILOT_USE_AI === "true";

  if (!apiKey || !enabled) {
    return null;
  }

  const model = process.env.OPENAI_MODEL || "gpt-5.6";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      tools: process.env.AUDITPILOT_ENABLE_WEB_SEARCH === "true" ? [{ type: "web_search_preview" }] : [],
      input: [
        {
          role: "system",
          content:
            "You are AuditPilot, a senior smart contract security agent. Review the provided normalized repository context and improve or challenge the seed findings. Return concise JSON only."
        },
        {
          role: "user",
          content: JSON.stringify({
            ecosystem: input.ecosystem,
            contractUnits: input.units,
            seedFindings: input.seedFindings
          })
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "auditpilot_research",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              notes: {
                type: "array",
                items: { type: "string" }
              },
              recommendedFocus: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["notes", "recommendedFocus"]
          },
          strict: true
        }
      }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI research failed: ${response.status} ${body}`);
  }

  return response.json();
}