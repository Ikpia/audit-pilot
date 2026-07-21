import Link from "next/link";
import { ApiKeySettings } from "@/components/api-key-settings";
import { AuthControls } from "@/components/auth-controls";
import { ShieldCheck } from "lucide-react";

export default function SettingsPage() {
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
        <section className="section">
          <div className="section-head"><h2>Settings</h2></div>
          <ApiKeySettings />
        </section>
      </main>
    </div>
  );
}