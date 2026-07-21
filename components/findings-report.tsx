import { Sparkles } from "lucide-react";
import type { AuditFinding, AuditSeverity } from "@/lib/audit/types";

type FindingsReportProps = {
  findings: AuditFinding[];
};

export function FindingsReport({ findings }: FindingsReportProps) {
  const severityCounts: Record<AuditSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    informational: 0
  };

  findings.forEach((finding) => {
    severityCounts[finding.severity] += 1;
  });

  return (
    <section className="section">
      <div className="section-head">
        <h2>Audit Report</h2>
        {findings.length > 0 ? (
          <span className="pill">
            <Sparkles size={14} />
            {severityCounts.critical + severityCounts.high} urgent
          </span>
        ) : null}
      </div>

      {findings.length > 0 ? (
        <div className="findings">
          {findings.map((finding) => (
            <article className="finding" key={finding.id}>
              <div className="finding-head">
                <span className={`severity ${finding.severity}`}>{finding.severity}</span>
                <div>
                  <h3>{finding.title}</h3>
                  <p>{finding.summary}</p>
                </div>
                <span className="finding-meta">{Math.round(finding.confidence * 100)}% confidence</span>
              </div>
              <div className="code-ref">{finding.location}</div>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty">No findings saved for this audit run.</div>
      )}
    </section>
  );
}