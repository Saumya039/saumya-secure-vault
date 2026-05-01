"use client";

import { FormEvent, useState } from "react";
import { KeyRound, Loader2, LockKeyhole, LogIn, UserPlus } from "lucide-react";
import { MIN_PASSWORD_LENGTH } from "@/lib/limits";

type AuthMode = "login" | "register";

type AuthPanelProps = {
  isConfigured: boolean;
};

export function AuthPanel({ isConfigured }: AuthPanelProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Authentication failed.");
      }

      window.location.href = "/";
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <section className="auth-layout" aria-labelledby="auth-title">
      <div className="identity-panel">
        <div className="brand-mark" aria-hidden="true">
          <LockKeyhole size={28} />
        </div>
        <p className="eyebrow">saumyas.dev</p>
        <h1 id="auth-title">Secure Vault</h1>
        <dl className="status-grid">
          <div>
            <dt>Encryption</dt>
            <dd>AES-GCM</dd>
          </div>
          <div>
            <dt>Database</dt>
            <dd>{isConfigured ? "Ready" : "Needs URL"}</dd>
          </div>
          <div>
            <dt>Session</dt>
            <dd>HttpOnly</dd>
          </div>
        </dl>
      </div>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="segmented-control" role="tablist" aria-label="Authentication mode">
          <button
            aria-selected={mode === "login"}
            className={mode === "login" ? "active" : ""}
            onClick={() => setMode("login")}
            role="tab"
            type="button"
          >
            <LogIn size={16} />
            Sign in
          </button>
          <button
            aria-selected={mode === "register"}
            className={mode === "register" ? "active" : ""}
            onClick={() => setMode("register")}
            role="tab"
            type="button"
          >
            <UserPlus size={16} />
            Create
          </button>
        </div>

        <label className="field">
          <span>Email</span>
          <input
            autoComplete="email"
            inputMode="email"
            onChange={(event) => setEmail(event.target.value)}
            required
            type="email"
            value={email}
          />
        </label>

        <label className="field">
          <span>Password</span>
          <input
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            minLength={MIN_PASSWORD_LENGTH}
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </label>

        {message ? <p className="form-message error">{message}</p> : null}
        {!isConfigured ? <p className="form-message error">DATABASE_URL is required before login.</p> : null}

        <button className="primary-action" disabled={isSubmitting || !isConfigured} type="submit">
          {isSubmitting ? <Loader2 className="spin" size={18} /> : <KeyRound size={18} />}
          {mode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
    </section>
  );
}
