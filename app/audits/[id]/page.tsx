import Link from "next/link";
import { AuthControls } from "@/components/auth-controls";
import { FindingsReport } from "@/components/findings-report";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuditRunRow } from "@/lib/supabase/types";
import { ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AuditDetailPage({ params }: PageProps) {
  const { id } = await params;
  let run: AuditRunRow | null = null;
  let errorMessage: string | null = null;

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("audit_runs")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) throw error;
    run = data as AuditRunRow | null;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "Could not load audit.";
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
            <Link className="topbar-meta" href="/audits">My audits</Link>
            <AuthControls />
          </nav>
        </div>
      </header>
      <main className="main narrow-main">
        {errorMessage ? <div className="error">{errorMessage}</div> : null}
        {!run && !errorMessage ? <div className="empty">Audit not found.</div> : null}
        {run ? (
          <>
            <section className="section">
              <div className="section-head"><h2>{run.repo_url}</h2><span className="pill">{run.status}</span></div>
              <div className="code-ref">{run.chain} | {new Date(run.created_at).toLocaleString()}</div>
            </section>
            <FindingsReport findings={run.findings} />
          </>
        ) : null}
      </main>
    </div>
  );
}