import { runOpenAIResearch } from "../research/openaiResearch";
import { searchSoloditFindings } from "../research/soloditClient";
import type { AuditFinding, ContractUnit, SmartContractEcosystem } from "./types";

type ResearchOptions = {
  openaiApiKey?: string;
  useAi?: boolean;
};

export async function enrichFindingsWithResearch(
  ecosystem: SmartContractEcosystem,
  units: ContractUnit[],
  seedFindings: AuditFinding[],
  options: ResearchOptions = {}
) {
  const language = ecosystem === "solana" ? "rust" : ecosystem === "solidity" ? "solidity" : undefined;
  const groundedFindings = await Promise.all(
    seedFindings.map(async (finding) => {
      const historicalFindings = await searchSoloditFindings({
        query: `${finding.title} ${finding.summary}`,
        language,
        severity: finding.severity,
        limit: 3
      });

      if (historicalFindings.length === 0) {
        return finding;
      }

      return {
        ...finding,
        confidence: Math.min(0.96, finding.confidence + 0.08),
        references: [
          ...finding.references,
          ...historicalFindings
            .map((historicalFinding) => historicalFinding.url || historicalFinding.source)
            .filter((reference): reference is string => Boolean(reference))
        ]
      };
    })
  );

  const openaiResearch = await runOpenAIResearch(
    {
      ecosystem,
      units,
      seedFindings: groundedFindings
    },
    {
      apiKey: options.openaiApiKey,
      enabled: options.useAi
    }
  );

  return {
    findings: groundedFindings,
    openaiResearch
  };
}