import { useState } from "react";
import { Section, Panel, Notice } from "@/components/Shell";
import { Button } from "@/components/ui/button";
import { Input, Field } from "@/components/ui/input";
import { useAuth } from "@/components/useAuth";
import { auth, post, ApiError, type AuthResponse } from "@/lib/api";

type Mode = "login" | "register";

export default function AccountPage() {
  const { user, isSignedIn, signOut } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [sent, setSent] = useState<string | null>(null);
  const [code, setCode] = useState("");

  async function submit() {
    setBusy(true);
    setError(null);
    setFieldErrors({});

    try {
      const response =
        mode === "login"
          ? await post<AuthResponse>("/api/auth/login", { email, password })
          : await post<AuthResponse>("/api/auth/register", { fullName, email, password, phoneNumber: phone || null });

      auth.apply(response);
      setPassword("");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setFieldErrors(err.fieldErrors ?? {});
      } else {
        setError("That did not work. Check your connection and try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendCode(channel: "Email" | "Sms") {
    setSent(null);
    try {
      await post("/api/auth/verification/send", { channel });
      setSent(`Code sent by ${channel === "Sms" ? "SMS" : "e-mail"}. In development it is printed to the API console.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The code could not be sent.");
    }
  }

  async function confirmCode(channel: "Email" | "Sms") {
    try {
      await post("/api/auth/verification/confirm", { channel, code });
      setSent("Verified.");
      setCode("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "That code was not accepted.");
    }
  }

  if (isSignedIn && user) {
    return (
      <Section title={`Signed in as ${user.fullName}`} lede="Verify your contact details to unlock rental reminders.">
        <div className="grid gap-4 md:grid-cols-2">
          <Panel>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-ink-mute">E-mail</dt>
                <dd className="text-ink">{user.email} {user.isEmailConfirmed ? "✓" : "— unverified"}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-mute">Phone</dt>
                <dd className="text-ink">{user.phoneNumber ?? "not set"} {user.isPhoneConfirmed ? "✓" : ""}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-ink-mute">Roles</dt>
                <dd className="text-ink">{user.roles.join(", ")}</dd>
              </div>
            </dl>
            <Button variant="outline" className="mt-5" onClick={signOut}>Sign out</Button>
          </Panel>

          <Panel>
            <h3 className="font-display text-lg text-ink">Verification</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => sendCode("Email")}>Send e-mail code</Button>
              <Button size="sm" variant="outline" onClick={() => sendCode("Sms")}>Send SMS code</Button>
            </div>

            <div className="mt-4 flex gap-2">
              <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="6-digit code" inputMode="numeric" aria-label="Verification code" />
              <Button size="sm" onClick={() => confirmCode("Email")} disabled={code.length < 4}>Confirm</Button>
            </div>

            {sent ? <div className="mt-3"><Notice tone="ok">{sent}</Notice></div> : null}
            {error ? <div className="mt-3"><Notice tone="error">{error}</Notice></div> : null}
          </Panel>
        </div>
      </Section>
    );
  }

  return (
    <Section
      title={mode === "login" ? "Sign in" : "Create an account"}
      lede="The seeded accounts are admin@reelandrow.test / Admin1234 and customer@reelandrow.test / Customer1234."
    >
      <Panel className="max-w-md">
        <div className="mb-5 flex gap-2">
          <Button size="sm" variant={mode === "login" ? "solid" : "ghost"} onClick={() => setMode("login")}>Sign in</Button>
          <Button size="sm" variant={mode === "register" ? "solid" : "ghost"} onClick={() => setMode("register")}>Register</Button>
        </div>

        <div className="space-y-4">
          {mode === "register" ? (
            <Field label="Full name">
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            </Field>
          ) : null}

          <Field label="E-mail" hint={fieldErrors.Email?.[0]}>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </Field>

          {mode === "register" ? (
            <Field label="Phone" hint="Optional — used for SMS codes and due-date alerts.">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" placeholder="+994501234567" />
            </Field>
          ) : null}

          <Field
            label="Password"
            hint={fieldErrors.Password?.[0] ?? (mode === "register" ? "Eight characters, one capital, one digit." : undefined)}
          >
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </Field>

          {error ? <Notice tone="error">{error}</Notice> : null}

          <Button className="w-full" disabled={busy || !email || !password} onClick={submit}>
            {busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </div>
      </Panel>
    </Section>
  );
}
