import type { AuditFinding, SmartContractEcosystem } from "../audit/types";

export type AuditRunStatus = "running" | "completed" | "failed";

export type ApiKeyRow = {
  id: string;
  user_id: string;
  encrypted_key: string;
  created_at: string;
  updated_at: string;
};

export type AuditRunRow = {
  id: string;
  user_id: string;
  repo_url: string;
  chain: Exclude<SmartContractEcosystem, "unknown"> | "unknown";
  status: AuditRunStatus;
  findings: AuditFinding[];
  pr_url: string | null;
  created_at: string;
  completed_at: string | null;
};