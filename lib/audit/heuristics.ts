import type { AuditFinding, ContractUnit, SmartContractEcosystem } from "./types";

export function generateSeedFindings(
  ecosystem: SmartContractEcosystem,
  units: ContractUnit[]
): AuditFinding[] {
  if (ecosystem === "solidity") {
    return generateSolidityFindings(units);
  }

  if (ecosystem === "solana") {
    return generateSolanaFindings(units);
  }

  return [
    {
      id: "unknown-001",
      title: "Unsupported smart contract stack",
      severity: "informational",
      confidence: 0.5,
      summary:
        "AuditPilot could not confidently classify this repository as Solidity or Solana. The ingestion layer is ready for more adapters, but this run did not produce security findings.",
      location: "repository root",
      recommendation: "Add a chain adapter or submit a Solidity/Anchor repository.",
      references: []
    }
  ];
}

function generateSolidityFindings(units: ContractUnit[]): AuditFinding[] {
  const assetUnit = units.find((unit) =>
    unit.signals.some((signal) => signal === "asset custody" || signal === "token logic")
  );
  const upgradeUnit = units.find((unit) =>
    unit.signals.some((signal) => signal === "upgradeability")
  );

  return [
    {
      id: "sol-001",
      title: "External value flow needs reentrancy and state-order review",
      severity: "high",
      confidence: assetUnit ? 0.78 : 0.62,
      summary:
        "Contracts that custody assets or transfer tokens need explicit review of call ordering, reentrancy guards, and post-transfer accounting. The agent flags this area first because exploit impact can be direct fund loss.",
      location: assetUnit?.path ?? units[0]?.path ?? "contracts/",
      recommendation:
        "Apply checks-effects-interactions, add reentrancy protection around withdrawal paths, and verify accounting updates happen before external calls.",
      references: ["SWC-107", "OpenZeppelin ReentrancyGuard"]
    },
    {
      id: "sol-002",
      title: "Privileged roles should be bounded by timelocks or multisig controls",
      severity: "medium",
      confidence: 0.7,
      summary:
        "Owner-only configuration and upgrade paths are a common source of centralization and key-compromise risk. The audit should confirm role separation, event emission, and delayed execution for sensitive operations.",
      location: upgradeUnit?.path ?? units[0]?.path ?? "contracts/",
      recommendation:
        "Gate privileged operations behind multisig/timelock controls and emit events for each critical parameter change.",
      references: ["OpenZeppelin AccessControl", "OpenZeppelin TimelockController"]
    }
  ];
}

function generateSolanaFindings(units: ContractUnit[]): AuditFinding[] {
  const stateUnit = units.find((unit) =>
    unit.signals.some((signal) => signal === "account state" || signal === "instruction handlers")
  );
  const tokenUnit = units.find((unit) =>
    unit.signals.some((signal) => signal === "SPL token flow")
  );

  return [
    {
      id: "solana-001",
      title: "Instruction accounts need signer, owner, and PDA validation",
      severity: "high",
      confidence: stateUnit ? 0.8 : 0.64,
      summary:
        "Solana programs are frequently exploitable when account constraints are incomplete. The agent prioritizes validation of signer authority, account owner, PDA seeds, bumps, and relationship checks between supplied accounts.",
      location: stateUnit?.path ?? units[0]?.path ?? "programs/",
      recommendation:
        "Use Anchor constraints for signer, owner, seeds, bump, has_one, and custom validation for cross-account relationships.",
      references: ["Anchor account constraints", "Solana program security course"]
    },
    {
      id: "solana-002",
      title: "Token transfers should verify mint, token authority, and destination ownership",
      severity: "medium",
      confidence: tokenUnit ? 0.76 : 0.58,
      summary:
        "SPL token flows can be abused when the program trusts arbitrary token accounts. The audit should verify mint binding, authority derivation, and destination account ownership before CPI transfer calls.",
      location: tokenUnit?.path ?? stateUnit?.path ?? units[0]?.path ?? "programs/",
      recommendation:
        "Bind token accounts to expected mints and authorities, and derive CPI signer seeds from verified PDA state.",
      references: ["SPL Token Program", "Anchor token constraints"]
    }
  ];
}
