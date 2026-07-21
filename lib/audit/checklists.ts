import type { SmartContractEcosystem } from "./types";

const solidityChecklist = [
  "Access control on privileged functions and upgrade paths",
  "Reentrancy around external calls and value transfers",
  "Checks-effects-interactions ordering",
  "Unchecked return values from low-level calls or token transfers",
  "Oracle manipulation, stale prices, and decimal mismatches",
  "Unsafe approvals, permit handling, and allowance race assumptions",
  "Upgradeable storage layout and initializer protection",
  "Integer precision loss, rounding direction, and fee accounting",
  "Denial of service from unbounded loops or external dependency failure",
  "Event coverage for critical state changes"
];

const solanaChecklist = [
  "Signer and writable account validation for every instruction",
  "Owner checks for all supplied accounts",
  "PDA seed, bump, and canonical derivation validation",
  "has_one or equivalent relationship checks between accounts",
  "SPL token mint, token account owner, and authority binding",
  "CPI signer seed correctness and arbitrary CPI target prevention",
  "Account initialization, reinitialization, and close-account safety",
  "Rent exemption and lamport balance edge cases",
  "Arithmetic overflow, precision loss, and unchecked unwrap/panic paths",
  "Instruction replay, duplicate mutable accounts, and account substitution"
];

export function getVulnerabilityChecklist(chain: Exclude<SmartContractEcosystem, "unknown">) {
  return chain === "solidity" ? solidityChecklist : solanaChecklist;
}