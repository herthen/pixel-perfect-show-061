import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const search = z.object({
  mode: z.enum(["signin", "signup"]).optional(),
});

export const Route = createFileRoute("/auth")({
  ssr: false,
  validateSearch: search,
  component: AuthPage,
});

function AuthPage() {
  const { mode: initialMode } = useSearch({ from: "/auth" });
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">(initialMode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        toast.success("Welcome. Setting up your desk…");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen grid-cols-1 bg-background md:grid-cols-2">
      <aside className="relative hidden flex-col justify-between border-r border-border bg-sidebar p-10 md:flex">
        <Link to="/" className="flex items-center gap-3">
          <span className="ink-mark" aria-hidden />
          <div className="leading-tight">
            <div className="font-serif text-[15px]">Inkstone</div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
              Chinese
            </div>
          </div>
        </Link>
        <div>
          <div className="font-cjk text-[7rem] leading-none text-foreground/85">学</div>
          <p className="mt-8 max-w-sm font-serif text-lg leading-snug text-muted-foreground">
            "Learning without thought is labour lost; thought without learning is perilous."
          </p>
          <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-foreground/70">
            — Confucius, Analects II.15
          </p>
        </div>
        <div className="text-[11px] text-muted-foreground/70">Study a little, every day.</div>
      </aside>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <Link to="/" className="mb-8 flex items-center gap-2 md:hidden">
            <span className="ink-mark" aria-hidden />
            <span className="font-serif">Inkstone Chinese</span>
          </Link>

          <h1 className="font-serif text-3xl text-foreground">
            {mode === "signup" ? "Begin your practice" : "Welcome back"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {mode === "signup"
              ? "Create your desk in under a minute — no confirmations to wait for."
              : "Sign in to pick up where you left off."}
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
                Email
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-cinnabar/70"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wider text-muted-foreground">
                Password
              </span>
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-input bg-surface px-3 py-2.5 text-sm outline-none focus:border-cinnabar/70"
              />
            </label>
            <button
              type="submit"
              disabled={submitting}
              className="mt-2 w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting
                ? "Please wait…"
                : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-sm text-muted-foreground">
            {mode === "signup" ? "Already have an account? " : "New here? "}
            <button
              type="button"
              onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
              className="text-cinnabar underline-offset-4 hover:underline"
            >
              {mode === "signup" ? "Sign in" : "Create one"}
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}
