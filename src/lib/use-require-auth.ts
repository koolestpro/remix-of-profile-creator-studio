import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

/**
 * Guards an admin route. Redirects to /login when Supabase is configured and
 * there is no active session. When Supabase isn't set up yet, auth is a no-op
 * so the app keeps working in its pre-backend state.
 *
 * Returns `ready` — true when it's safe to render the protected content.
 */
export function useRequireAuth() {
  const { session, loading, configured } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!configured) return;
    if (!loading && !session) {
      navigate({ to: "/login" });
    }
  }, [session, loading, configured, navigate]);

  return {
    ready: !configured || (!loading && !!session),
    configured,
    loading,
  };
}
