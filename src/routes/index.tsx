import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <span className="ink-mark" aria-hidden />
          <div className="leading-tight">
            <div className="font-serif text-[15px]">Inkstone</div>
            <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Chinese</div>
          </div>
        </div>
        <Link
          to="/auth"
          className="rounded-md border border-border bg-surface px-3.5 py-1.5 text-sm text-foreground hover:bg-accent"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-10 md:pt-24">
        <p className="text-xs uppercase tracking-[0.2em] text-cinnabar">A quiet study desk</p>
        <h1 className="mt-4 font-serif text-4xl leading-[1.1] text-foreground md:text-6xl">
          Study Mandarin the way you'd read a book —{" "}
          <span className="italic text-muted-foreground">slowly, and every day.</span>
        </h1>
        <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground">
          Inkstone Chinese asks one honest question at a time: <em>did you know it?</em> Spaced
          repetition brings words back at the right moment, so a handful of new characters each day
          quietly becomes fluency.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-3">
          <Link
            to="/auth"
            search={{ mode: "signup" as const }}
            className="inline-flex items-center rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Start studying — it's free
          </Link>
          <Link
            to="/auth"
            className="inline-flex items-center rounded-md border border-border bg-surface px-5 py-2.5 text-sm hover:bg-accent"
          >
            I have an account
          </Link>
        </div>

        <div className="mt-20 grid grid-cols-1 gap-8 border-t border-border pt-10 md:grid-cols-3">
          {[
            {
              t: "Assess honestly",
              d: "Pronunciation first, then meaning. Two small taps, no scores to game.",
            },
            {
              t: "Return at the right time",
              d: "An SM-2-inspired schedule brings each word back just before you'd forget.",
            },
            {
              t: "Built on HSK 1 & 2",
              d: "300 curated words across two levels. Start with HSK 1 basics, then advance to HSK 2.",
            },
          ].map((f) => (
            <div key={f.t}>
              <div className="mb-3 h-[2px] w-6 bg-cinnabar" />
              <div className="font-serif text-lg">{f.t}</div>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.d}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        Inkstone Chinese · A calm way to learn.
      </footer>
    </div>
  );
}
