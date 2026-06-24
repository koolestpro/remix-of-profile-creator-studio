import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Lock, Loader2, Mail, RefreshCw, ArrowLeft, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [{ title: "Sign in — Link Profile Studio" }],
  }),
  component: LoginPage,
});

const RESEND_COOLDOWN = 60;

function LoginPage() {
  const { session, loading, configured, signIn, verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();

  // ── Step 1: credentials ──────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Step 2: inbox / OTP ──────────────────────────────────────────────────
  const [step, setStep] = useState<"credentials" | "sent">("credentials");
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /**
   * When true, we're in the middle of a sign-in submission.
   * We use a ref (not state) so changing it doesn't cause extra renders —
   * its sole purpose is to stop the "already-signed-in → navigate /" effect
   * from firing during the brief window where signInWithPassword has created
   * a temporary session that we immediately sign out of.
   */
  const signingInRef = useRef(false);

  // Auto-navigate returning users who are already signed in, but NOT during
  // an active sign-in flow (signingInRef guards against the brief session
  // that signInWithPassword creates before we revoke it for 2FA).
  useEffect(() => {
    if (!loading && session && !signingInRef.current) {
      navigate({ to: "/" });
    }
  }, [session, loading, navigate]);

  // Countdown timer for "Resend" button.
  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN);
    cooldownRef.current = setInterval(() => {
      setCooldown((s) => {
        if (s <= 1) {
          clearInterval(cooldownRef.current!);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  };

  useEffect(
    () => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); },
    [],
  );

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    // Block auto-navigation BEFORE the async call so the brief session from
    // signInWithPassword doesn't cause a premature redirect to "/".
    signingInRef.current = true;
    setSubmitting(true);

    const { needsOtp, error } = await signIn(email, password);

    setSubmitting(false);

    if (error) {
      signingInRef.current = false; // re-enable auto-navigation on failure
      toast.error(error);
      return;
    }

    if (needsOtp) {
      setStep("sent");
      startCooldown();
      // Keep signingInRef.current = true until OTP is verified or user goes back.
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length < 6) return;
    setVerifying(true);
    const { error } = await verifyOtp(email, otp);
    setVerifying(false);

    if (error) {
      toast.error("Invalid or expired code. Try again.");
      setOtp("");
      return;
    }

    // OTP verified — navigate manually (don't rely on the useEffect).
    signingInRef.current = false;
    navigate({ to: "/" });
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    const { error } = await resendOtp(email);
    if (error) { toast.error(error); return; }
    toast.success("New link sent — check your inbox");
    setOtp("");
    startCooldown();
  };

  const handleBack = () => {
    signingInRef.current = false;
    setStep("credentials");
    setOtp("");
    if (cooldownRef.current) clearInterval(cooldownRef.current);
    setCooldown(0);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="grid min-h-screen place-items-center bg-canvas px-4">
      <Toaster richColors position="top-right" />
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="mb-6 flex flex-col items-center text-center">
          <div
            className="grid h-12 w-12 place-items-center rounded-xl text-white"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="mt-3 text-lg font-semibold text-foreground">
            Link Profile Studio
          </h1>
          <p className="text-sm text-muted-foreground">
            {step === "credentials"
              ? "Sign in to manage your profiles"
              : "A verification link has been sent to your inbox"}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant">

          {/* Supabase not configured */}
          {!configured && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Supabase isn't connected yet. Add your keys to{" "}
              <span className="font-mono">.env.local</span> to enable sign-in.
            </div>
          )}

          {/* ══════════════════ STEP 1: email + password ══════════════════ */}
          {step === "credentials" && (
            <form onSubmit={handleCredentials} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Email</label>
                <Input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@yourbusiness.com"
                  disabled={!configured || submitting}
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Password</label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={!configured || submitting}
                />
              </div>

              <Button
                type="submit"
                disabled={!configured || submitting || !email || !password}
                className="w-full text-white shadow-md"
                style={{ background: "var(--gradient-primary)" }}
              >
                {submitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Sending code…</>
                ) : (
                  <><Lock className="mr-2 h-4 w-4" /> Continue</>
                )}
              </Button>
            </form>
          )}

          {/* ══════════════════ STEP 2: check inbox ══════════════════ */}
          {step === "sent" && (
            <div className="space-y-5">

              {/* Sent confirmation */}
              <div className="flex flex-col items-center gap-3 py-2 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
                  <MailCheck className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Check your inbox</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    We sent a sign-in link to
                  </p>
                  <div className="mt-1 flex items-center justify-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground">{email}</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Click the link in the email to sign in.
                  </p>
                </div>
              </div>

              {/* Divider */}
              <div className="flex items-center gap-2">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground">or enter a code</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              {/* OTP input (for when Supabase is set to OTP mode) */}
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={8}
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 8))}
                  placeholder="00000000"
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  disabled={verifying}
                />
                <Button
                  type="submit"
                  disabled={verifying || otp.length < 6}
                  className="w-full text-white shadow-md"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  {verifying ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…</>
                  ) : (
                    <><Lock className="mr-2 h-4 w-4" /> Verify code</>
                  )}
                </Button>
              </form>

              {/* Resend + back */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleBack}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-3 w-3" /> Back
                </button>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RefreshCw className="h-3 w-3" />
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend link"}
                </button>
              </div>
            </div>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Access is invite-only. Accounts are created by the administrator.
        </p>
      </div>
    </div>
  );
}
