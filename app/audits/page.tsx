import Link from "next/link";
import { AuthControls } from "@/components/auth-controls";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuditRunRow } from "@/lib/supabase/types";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AuditsPage() {
  let userId: string | null = null;
  let runs: AuditRunRow[] = [];
  let setupError: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data: userResult } = await supabase.auth.getUser();
    userId = userResult.user?.id ?? null;

    if (userId) {
      const { data, error } = await supabase
        .from("audit_runs")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      runs = (data ?? []) as AuditRunRow[];
    }
  } catch (error) {
    setupError = error instanceof Error ? error.message : "Could not load audits.";
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-inner">
          <Link className="brand" href="/">
            <div className="brand-mark"><ShieldCheck size={18} /></div>
            AuditPilot
          </Link>
          <nav className="nav-actions">
            <Link className="topbar-meta" href="/settings">Settings</Link>
            <AuthControls />
          </nav>
        </div>
      </header>
      <main className="main narrow-main">
        <section className="section">
          <div className="section-head"><h2>My audits</h2></div>
          {setupError ? <div className="error">{setupError}</div> : null}
          {!userId && !setupError ? <div className="empty">Sign in with GitHub to see your audit history.</div> : null}
          {userId && runs.length === 0 ? <div className="empty">No audits yet.</div> : null}
          <div className="audit-list">
            {runs.map((run) => (
              <Link className="audit-row" href={`/audits/${run.id}`} key={run.id}>
                <span>{run.repo_url}</span>
                <strong>{run.chain}</strong>
                <em>{run.status}</em>
                <small>{run.findings.length} findings</small>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}