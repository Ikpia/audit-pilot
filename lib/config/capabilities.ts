export function getAuditPilotCapabilities() {
  return {
    ecosystems: ["solidity", "solana-anchor"],
    surfaces: ["web-app", "http-api", "mcp-stdio"],
    tools: ["audit_contract_repo"],
    apis: {
      github: {
        status: process.env.GITHUB_TOKEN ? "token-configured" : "unauthenticated",
        required: true,
        env: ["GITHUB_TOKEN"]
      },
      openaiResponses: {
        status: process.env.AUDITPILOT_USE_AI === "true" ? "enabled" : "disabled",
        required: false,
        env: ["OPENAI_API_KEY", "OPENAI_MODEL", "AUDITPILOT_USE_AI"]
      },
      openaiWebSearch: {
        status: process.env.AUDITPILOT_ENABLE_WEB_SEARCH === "true" ? "enabled" : "disabled",
        required: false,
        env: ["AUDITPILOT_ENABLE_WEB_SEARCH"]
      },
      soloditCompatibleResearch: {
        status: process.env.AUDITPILOT_USE_SOLODIT === "true" ? "enabled" : "disabled",
        required: false,
        env: ["SOLODIT_API_URL", "SOLODIT_API_KEY", "AUDITPILOT_USE_SOLODIT"]
      }
    }
  };
}
