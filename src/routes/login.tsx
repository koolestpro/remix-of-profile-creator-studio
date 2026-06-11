import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Sparkles, Lock, Loader2 } from "lucide-react";
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

function LoginPage() {
  const { session, loading, configured, signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Already signed in → go to the dashboard.
  useEffect(() => {
    if (!loading && session) navigate({ to: "/" });
  }, [session, loading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setSubmitting(true);
    const { error } = await signIn(email, password);
    setSubmitting(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Signed in");
    navigate({ to: "/" });
  };

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
            Sign in to manage your profiles
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-elegant">
          {!configured && (
            <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Supabase isn't connected yet. Add your keys to{" "}
              <span className="font-mono">.env.local</span> to enable sign-in.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
              <label className="text-sm font-medium text-foreground">
                Password
              </label>
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
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" /> Sign in
                </>
              )}
            </Button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-muted-foreground">
          Access is invite-only. Accounts are created by the administrator.
        </p>
      </div>
    </div>
  );
}
