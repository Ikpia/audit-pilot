import { buildContractUnits, detectEcosystem } from "./detector";
import { parseGitHubUrl, fetchRepositoryTree } from "./github";
import { generateSeedFindings } from "./heuristics";
import { enrichFindingsWithResearch } from "./research";
import type { AuditReport, SmartContractEcosystem } from "./types";

const ecosystemLabels: Record<SmartContractEcosystem, string> = {
  solidity: "Solidity / EVM",
  solana: "Solana / Anchor",
  unknown: "Unknown stack"
};

type RunAuditOptions = {
  openaiApiKey?: string;
  useAi?: boolean;
};

export async function runAudit(repoUrl: string, options: RunAuditOptions = {}): Promise<AuditReport> {
  const repository = parseGitHubUrl(repoUrl);
  const tree = await fetchRepositoryTree(repository);
  const ecosystem = detectEcosystem(tree.files);
  const contractUnits = buildContractUnits(tree.files, ecosystem);
  const seedFindings = generateSeedFindings(ecosystem, contractUnits);
  const research = await enrichFindingsWithResearch(ecosystem, contractUnits, seedFindings, options);

  return {
    repository: {
      ...repository,
      defaultBranch: tree.defaultBranch
    },
    ecosystem,
    ecosystemLabel: ecosystemLabels[ecosystem],
    generatedAt: new Date().toISOString(),
    contractUnits,
    findings: research.findings,
    timeline: [
      `Inspected ${tree.files.length} repository files on ${tree.defaultBranch}`,
      `Detected ${ecosystemLabels[ecosystem]}`,
      `Mapped ${contractUnits.length} contract-facing files`,
      "Generated severity-ranked seed findings for the Codex audit loop",
      process.env.AUDITPILOT_USE_SOLODIT === "true"
        ? "Queried configured Solodit-compatible research API"
        : "Skipped Solodit research because AUDITPILOT_USE_SOLODIT is not enabled",
      options.useAi
        ? "Ran GPT research pass with the signed-in user's OpenAI key"
        : "Skipped GPT research because user-provided AI execution is not enabled"
    ]
  };
}