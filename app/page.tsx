"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Activity,
  Bot,
  BrainCircuit,
  ExternalLink,
  GitBranch,
  Radar,
  ShieldCheck
} from "lucide-react";
import { ApiKeySettings } from "@/components/api-key-settings";
import { AuthControls } from "@/components/auth-controls";
import { FindingsReport } from "@/components/findings-report";
import type { AuditReport } from "@/lib/audit/types";

const demoRepos = [
  "https://github.com/OpenZeppelin/openzeppelin-contracts",
  "https://github.com/coral-xyz/anchor"
];

type AuditError = {
  error: string;
  code?: string;
  billingUrl?: string;
};

export default function Home() {
  const [repoUrl, setRepoUrl] = useState(demoRepos[0]);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState<AuditError | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function runAudit() {
    setIsRunning(true);
    setError(null);
    setReport(null);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ repoUrl })
      });

      const payload = (await response.json()) as AuditReport | AuditError;

      if (!response.ok) {
        setError("error" in payload ? payload : { error: "Audit failed" });
        return;
      }

      setReport(payload as AuditReport);
    } catch (caught) {
      setError({ error: caught instanceof Error ? caught.message : "Audit failed" });
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <div className="brand">
            <div className="brand-mark">
              <ShieldCheck size={18} />
            </div>
            AuditPilot
          </div>
          <nav className="nav-actions">
            <Link className="topbar-meta" href="/audits">My audits</Link>
            <Link className="topbar-meta" href="/settings">Settings</Link>
            <AuthControls />
          </nav>
        </div>
      </header>

      <main className="main">
        <section className="hero">
          <div className="hero-copy">
            <p className="eyebrow">OpenAI Build Week project</p>
            <h1>Smart contract audits run like an agent.</h1>
            <p className="lede">
              Submit a repo and AuditPilot detects the stack, maps the attack surface,
              checks vulnerability patterns, and returns an auditor-style report for
              Solidity and Solana programs.
            </p>
            <div className="metrics" aria-label="AuditPilot capabilities">
              <div className="metric">
                <strong>2</strong>
                <span>launch ecosystems</span>
              </div>
              <div className="metric">
                <strong>5</strong>
                <span>severity levels</span>
              </div>
              <div className="metric">
                <strong>1</strong>
                <span>shared agent engine</span>
              </div>
            </div>
          </div>

          <div className="audit-panel">
            <div className="form-row">
              <input
                aria-label="Repository URL"
                className="repo-input"
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                placeholder="https://github.com/org/repo"
              />
              <button className="primary-button" disabled={isRunning} onClick={runAudit}>
                {isRunning ? <Activity size={18} /> : <Radar size={18} />}
                {isRunning ? "Auditing" : "Run audit"}
              </button>
            </div>
            <p className="hint">
              Sign in and add your OpenAI key first. Web audits run on your own quota; MCP audits reason inside the connected agent&apos;s own session.
            </p>
            {error ? <AuditErrorMessage error={error} /> : null}

            <div className="status-grid">
              <div className="status-tile">
                <GitBranch size={18} />
                <span>Ingestion</span>
                <strong>{report ? report.repository.name : "Repo detector ready"}</strong>
              </div>
              <div className="status-tile">
                <BrainCircuit size={18} />
                <span>Reasoning</span>
                <strong>{report ? report.ecosystemLabel : "User-key GPT loop"}</strong>
              </div>
              <div className="status-tile">
                <Bot size={18} />
                <span>Output</span>
                <strong>{report ? `${report.findings.length} findings` : "Persistent report"}</strong>
              </div>
            </div>

            <ApiKeySettings />
          </div>
        </section>

        {report ? (
          <FindingsReport findings={report.findings} />
        ) : (
          <section className="section">
            <div className="section-head">
              <h2>Audit Report</h2>
            </div>
            <div className="empty">
              Run an audit to see severity-ranked findings, exploit reasoning, and fix recommendations.
            </div>
          </section>
        )}

        <section className="section">
          <div className="section-head">
            <h2>Agent Timeline</h2>
            {report?.repository.url ? (
              <a className="pill" href={report.repository.url} rel="noreferrer" target="_blank">
                <ExternalLink size={14} />
                Source repo
              </a>
            ) : null}
          </div>
          <div className="timeline">
            {(report?.timeline ?? [
              "Authenticate with GitHub through Supabase",
              "Load your encrypted OpenAI key server-side",
              "Create a persistent audit run before analysis starts",
              "Update audit history when findings are ready"
            ]).map((item) => (
              <div className="timeline-item" key={item}>
                <span className="timeline-dot" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function AuditErrorMessage({ error }: { error: AuditError }) {
  if (error.code === "insufficient_quota" && error.billingUrl) {
    return (
      <div className="error">
        This OpenAI key has no available quota Ã¢â‚¬â€ check billing at{" "}
        <a href={error.billingUrl} rel="noreferrer" target="_blank">platform.openai.com</a>.
      </div>
    );
  }

  if (error.code === "not_signed_in") {
    return <div className="error">Sign in with GitHub before running an audit.</div>;
  }

  if (error.code === "missing_api_key") {
    return <div className="error">Add your OpenAI API key in the panel below before running an audit.</div>;
  }

  return <div className="error">{error.error}</div>;
}