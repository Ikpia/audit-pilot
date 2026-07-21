import { NextResponse } from "next/server";
import { z } from "zod";
import { runAudit } from "@/lib/audit/engine";
import { decryptApiKey } from "@/lib/security/apiKeyCrypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const auditRequestSchema = z.object({
  repoUrl: z.string().url()
});

export async function POST(request: Request) {
  const parsed = auditRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Send a valid GitHub repository URL." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data: userResult } = await supabase.auth.getUser();

  if (!userResult.user) {
    return NextResponse.json(
      { error: "Sign in with GitHub before running an audit.", code: "not_signed_in" },
      { status: 401 }
    );
  }

  const { data: keyRow, error: keyError } = await supabase
    .from("api_keys")
    .select("encrypted_key")
    .eq("user_id", userResult.user.id)
    .maybeSingle();

  if (keyError) {
    return NextResponse.json({ error: keyError.message }, { status: 500 });
  }

  if (!keyRow?.encrypted_key) {
    return NextResponse.json(
      { error: "Add your OpenAI API key before running an audit.", code: "missing_api_key" },
      { status: 400 }
    );
  }

  const { data: runRow, error: insertError } = await supabase
    .from("audit_runs")
    .insert({
      user_id: userResult.user.id,
      repo_url: parsed.data.repoUrl,
      chain: "unknown",
      status: "running",
      findings: []
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  try {
    const openaiApiKey = decryptApiKey(keyRow.encrypted_key);
    const report = await runAudit(parsed.data.repoUrl, {
      openaiApiKey,
      useAi: true
    });

    await supabase
      .from("audit_runs")
      .update({
        chain: report.ecosystem,
        status: "completed",
        findings: report.findings,
        completed_at: new Date().toISOString()
      })
      .eq("id", runRow.id)
      .eq("user_id", userResult.user.id);

    return NextResponse.json({ ...report, auditRunId: runRow.id });
  } catch (caught) {
    await supabase
      .from("audit_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString()
      })
      .eq("id", runRow.id)
      .eq("user_id", userResult.user.id);

    const normalized = normalizeAuditError(caught);
    return NextResponse.json(normalized.body, { status: normalized.status });
  }
}

function normalizeAuditError(caught: unknown) {
  const message = caught instanceof Error ? caught.message : "Audit failed.";

  if (message.includes("insufficient_quota") || message.includes("429")) {
    return {
      status: 402,
      body: {
        error: "This OpenAI key has no available quota — check billing at platform.openai.com.",
        code: "insufficient_quota",
        billingUrl: "https://platform.openai.com/settings/organization/billing"
      }
    };
  }

  return {
    status: 500,
    body: { error: message }
  };
}