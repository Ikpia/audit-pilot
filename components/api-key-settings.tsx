"use client";

import { useEffect, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";

export function ApiKeySettings() {
  const [apiKey, setApiKey] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function refresh() {
    const response = await fetch("/api/settings/api-key");
    const payload = (await response.json()) as { signedIn: boolean; hasApiKey: boolean };
    setSignedIn(payload.signedIn);
    setHasApiKey(payload.hasApiKey);
  }

  useEffect(() => {
    refresh().catch(() => setMessage("Supabase is not configured yet."));
  }, []);

  async function saveKey() {
    setIsSaving(true);
    setMessage(null);

    const response = await fetch("/api/settings/api-key", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey })
    });
    const payload = (await response.json()) as { error?: string };

    setIsSaving(false);

    if (!response.ok) {
      setMessage(payload.error ?? "Could not save API key.");
      return;
    }

    setApiKey("");
    setHasApiKey(true);
    setMessage("OpenAI key saved encrypted.");
  }

  async function removeKey() {
    setMessage(null);
    const response = await fetch("/api/settings/api-key", { method: "DELETE" });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
      setMessage(payload.error ?? "Could not remove API key.");
      return;
    }

    setHasApiKey(false);
    setMessage("OpenAI key removed.");
  }

  return (
    <div className="settings-panel">
      <div className="section-head compact">
        <h2>OpenAI key</h2>
        <span className="pill">{hasApiKey ? "Saved" : "Required"}</span>
      </div>
      <p className="hint">
        AuditPilot uses your key for web audits. The key is encrypted server-side and never returned to the browser.
      </p>
      {!signedIn ? <div className="notice">Sign in with GitHub before saving a key.</div> : null}
      <div className="form-row key-row">
        <input
          aria-label="OpenAI API key"
          className="repo-input"
          disabled={!signedIn}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder="sk-..."
          type="password"
          value={apiKey}
        />
        <button className="primary-button" disabled={!signedIn || isSaving || !apiKey} onClick={saveKey} type="button">
          <KeyRound size={18} />
          Save
        </button>
        {hasApiKey ? (
          <button className="icon-button danger-button" onClick={removeKey} title="Remove key" type="button">
            <Trash2 size={16} />
          </button>
        ) : null}
      </div>
      {message ? <div className="notice">{message}</div> : null}
    </div>
  );
}