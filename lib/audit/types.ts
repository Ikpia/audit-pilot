export type SmartContractEcosystem = "solidity" | "solana" | "unknown";

export type AuditSeverity =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "informational";

export type RepositoryTarget = {
  owner: string;
  name: string;
  url: string;
  defaultBranch?: string;
};

export type ContractUnit = {
  path: string;
  language: "solidity" | "rust" | "unknown";
  signals: string[];
  unitName?: string;
  sourceCode?: string;
  externalCalls?: string[];
  metadata?: {
    framework?: string;
    imports?: string[];
    functions?: string[];
    lineCount?: number;
    sourceTruncated?: boolean;
  };
};

export type AuditFinding = {
  id: string;
  title: string;
  severity: AuditSeverity;
  confidence: number;
  summary: string;
  location: string;
  recommendation: string;
  references: string[];
};

export type AuditReport = {
  repository: RepositoryTarget;
  ecosystem: SmartContractEcosystem;
  ecosystemLabel: string;
  generatedAt: string;
  contractUnits: ContractUnit[];
  findings: AuditFinding[];
  timeline: string[];
};