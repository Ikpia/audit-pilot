"use client";

import { useEffect, useState } from "react";
import { Github, LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

type UserState = {
  email?: string;
  username?: string;
};

export function AuthControls() {
  const [user, setUser] = useState<UserState | null>(null);
  const [isConfigured, setIsConfigured] = useState(true);

  useEffect(() => {
    try {
      const supabase = createSupabaseBrowserClient();
      supabase.auth.getUser().then(({ data }) => {
        setUser(
          data.user
            ? {
                email: data.user.email ?? undefined,
                username:
                  (data.user.user_metadata.user_name as string | undefined) ||
                  (data.user.user_metadata.preferred_username as string | undefined) ||
                  (data.user.user_metadata.name as string | undefined)
              }
            : null
        );
      });

      const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
        setUser(
          session?.user
            ? {
                email: session.user.email ?? undefined,
                username:
                  (session.user.user_metadata.user_name as string | undefined) ||
                  (session.user.user_metadata.preferred_username as string | undefined) ||
                  (session.user.user_metadata.name as string | undefined)
              }
            : null
        );
      });

      return () => subscription.subscription.unsubscribe();
    } catch {
      setIsConfigured(false);
    }
  }, []);

  async function signIn() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/`
      }
    });
  }

  async function signOut() {
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    setUser(null);
  }

  if (!isConfigured) {
    return <span className="topbar-meta">Configure Supabase env</span>;
  }

  if (user) {
    return (
      <div className="auth-controls">
        <span className="topbar-meta">{user.username || user.email || "Signed in"}</span>
        <button className="icon-button" onClick={signOut} title="Sign out" type="button">
          <LogOut size={16} />
        </button>
      </div>
    );
  }

  return (
    <button className="secondary-button" onClick={signIn} type="button">
      <Github size={16} />
      Sign in
    </button>
  );
}