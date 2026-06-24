import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Lock, Loader2, Mail, RefreshCw, ArrowLeft } from "lucide-react";
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

// How long (seconds) before the "Resend" button re-enables.
const RESEND_COOLDOWN = 60;

function LoginPage() {
  const { session, loading, configured, signIn, verifyOtp, resendOtp } = useAuth();
  const navigate = useNavigate();

  // ── Step 1: credentials ──────────────────────────────────────────────────
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Step 2: OTP ──────────────────────────────────────────────────────────
  const [step, setStep] = useState<"credentials" | "otp">("credentials");
  const [otp, setOtp] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Already signed in → go to dashboard.
  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
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

  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current); }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    const { needsOtp, error } = await signIn(email, password);
    setSubmitting(false);

    if (error) {
      toast.error(error);
      return;
    }

    if (needsOtp) {
      setStep("otp");
      startCooldown();
      toast.success("Code sent — check your inbox");
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

    toast.success("Signed in");
    navigate({ to: "/" });
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    const { error } = await resendOtp(email);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("New code sent");
    setOtp("");
    startCooldown();
  };

  const handleBack = () => {
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
              : "Check your email for a verification code"}
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant">

          {/* ── Supabase not connected warning ── */}
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
                  placeholder="you@business.com"
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
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" /> Continue
                  </>
                )}
              </Button>
            </form>
          )}

          {/* ══════════════════ STEP 2: OTP ══════════════════ */}
          {step === "otp" && (
            <form onSubmit={handleVerifyOtp} className="space-y-4">

              {/* Email indicator */}
              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                <Mail className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm text-foreground">{email}</span>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Verification code
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  autoComplete="one-time-code"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-2xl tracking-[0.5em] font-mono"
                  disabled={verifying}
                  autoFocus
                />
                <p className="text-xs text-muted-foreground">
                  Enter the 6-digit code we sent to your email.
                </p>
              </div>

              <Button
                type="submit"
                disabled={verifying || otp.length < 6}
                className="w-full text-white shadow-md"
                style={{ background: "var(--gradient-primary)" }}
              >
                {verifying ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Verifying…
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-4 w-4" /> Confirm & sign in
                  </>
                )}
              </Button>

              {/* Resend + back */}
              <div className="flex items-center justify-between pt-1">
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
                  {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
                </button>
              </div>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Access is invite-only. Accounts are created by the administrator.
        </p>
      </div>
    </div>
  );
}
