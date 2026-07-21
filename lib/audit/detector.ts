import type { ContractUnit, SmartContractEcosystem } from "./types";

const solidityConfigMarkers = [
  "foundry.toml",
  "hardhat.config.js",
  "hardhat.config.ts",
  "truffle-config.js",
  "remappings.txt"
];

const solanaConfigMarkers = ["Anchor.toml", "programs/", "Cargo.toml"];

export function detectEcosystem(files: string[]): SmartContractEcosystem {
  const hasSolidity = files.some(
    (file) => file.endsWith(".sol") || solidityConfigMarkers.includes(file)
  );

  const hasSolana = files.some(
    (file) =>
      file.endsWith(".rs") &&
      (file.startsWith("programs/") ||
        files.includes("Anchor.toml") ||
        file.includes("/src/lib.rs"))
  );

  if (hasSolidity) {
    return "solidity";
  }

  if (hasSolana || files.some((file) => solanaConfigMarkers.some((marker) => file.includes(marker)))) {
    return "solana";
  }

  return "unknown";
}

export function buildContractUnits(files: string[], ecosystem: SmartContractEcosystem) {
  const contractFiles =
    ecosystem === "solidity"
      ? files.filter((file) => file.endsWith(".sol"))
      : files.filter((file) => file.endsWith(".rs") && file.startsWith("programs/"));

  return contractFiles.slice(0, 24).map<ContractUnit>((path) => ({
    path,
    language: ecosystem === "solidity" ? "solidity" : ecosystem === "solana" ? "rust" : "unknown",
    signals: inferSignals(path, ecosystem)
  }));
}

function inferSignals(path: string, ecosystem: SmartContractEcosystem) {
  const lowered = path.toLowerCase();
  const signals: string[] = [];

  if (ecosystem === "solidity") {
    if (lowered.includes("token") || lowered.includes("erc")) signals.push("token logic");
    if (lowered.includes("vault") || lowered.includes("staking")) signals.push("asset custody");
    if (lowered.includes("proxy") || lowered.includes("upgrade")) signals.push("upgradeability");
    if (lowered.includes("oracle") || lowered.includes("price")) signals.push("oracle dependency");
  }

  if (ecosystem === "solana") {
    if (lowered.includes("instruction") || lowered.endsWith("lib.rs")) signals.push("instruction handlers");
    if (lowered.includes("state") || lowered.includes("account")) signals.push("account state");
    if (lowered.includes("token")) signals.push("SPL token flow");
    if (lowered.includes("pda") || lowered.includes("seed")) signals.push("PDA derivation");
  }

  return signals.length > 0 ? signals : ["contract surface"];
}
