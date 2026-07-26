import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { GraduationCap, BookText, Flame, ArrowRight, Sparkles } from "lucide-react";
import { settingsQuery, sessionsQuery, progressQuery, computeStreak } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/dashboard")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(settingsQuery());
    context.queryClient.ensureQueryData(sessionsQuery());
    context.queryClient.ensureQueryData(progressQuery());
  },
  component: Dashboard,
});

function Dashboard() {
  const { data: settings } = useSuspenseQuery(settingsQuery());
  const { data: sessions } = useSuspenseQuery(sessionsQuery());
  const { data: progress } = useSuspenseQuery(progressQuery());
  const navigate = useNavigate();

  const target = settings?.daily_new_word_target ?? 5;
  const todayKey = new Date().toISOString().slice(0, 10);
  const todaysSessions = sessions.filter((s) => s.started_at.slice(0, 10) === todayKey);
  const newToday = todaysSessions.reduce((sum, s) => sum + (s.new_words_count ?? 0), 0);
  const reviewsToday = todaysSessions.reduce((sum, s) => sum + (s.reviews_count ?? 0), 0);
  const streak = computeStreak(sessions);

  const now = new Date().toISOString();
  const dueCount = progress.filter((p) => p.due_at <= now && p.status !== "new").length;
  const learningCount = progress.filter((p) => p.status === "learning").length;
  const reviewCount = progress.filter((p) => p.status === "review").length;
  const masteredCount = progress.filter((p) => p.status === "mastered").length;

  const newRemaining = Math.max(0, target - newToday);

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {new Date().toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
          <h1 className="mt-2 font-serif text-4xl text-foreground">Your study desk</h1>
          <p className="mt-2 max-w-lg text-sm text-muted-foreground">
            {newRemaining === 0 && dueCount === 0
              ? "You're all caught up. Come back later — the words will find you."
              : `${dueCount} review${dueCount === 1 ? "" : "s"} waiting, and ${newRemaining} new word${newRemaining === 1 ? "" : "s"} to meet today.`}
          </p>
        </div>
        <button
          onClick={signOut}
          className="hidden text-xs text-muted-foreground hover:text-foreground md:block"
        >
          Sign out
        </button>
      </div>

      {/* Primary CTA */}
      <Link
        to="/study"
        className="mt-8 flex items-center justify-between rounded-lg border border-border bg-surface p-6 transition-colors hover:border-cinnabar/40"
      >
        <div className="flex items-center gap-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-cinnabar/10 text-cinnabar">
            <GraduationCap className="h-6 w-6" strokeWidth={1.6} />
          </div>
          <div>
            <div className="font-serif text-xl">Begin today's session</div>
            <div className="text-sm text-muted-foreground">
              {dueCount + newRemaining > 0
                ? `${dueCount + newRemaining} card${dueCount + newRemaining === 1 ? "" : "s"} ready`
                : "Nothing due — you can still study ahead"}
            </div>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 text-muted-foreground" />
      </Link>

      {/* Today's numbers */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="New today" value={`${newToday}/${target}`} accent />
        <Stat label="Reviews today" value={reviewsToday} />
        <Stat label="Current streak" value={streak} icon={<Flame className="h-3.5 w-3.5" />} />
        <Stat label="Words mastered" value={masteredCount} />
      </div>

      {/* Library breakdown */}
      <section className="mt-10">
        <h2 className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Your library
        </h2>
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <LibCell label="Learning" value={learningCount} tone="amber" />
          <LibCell label="In review" value={reviewCount} tone="ink" />
          <LibCell label="Mastered" value={masteredCount} tone="moss" />
          <LibCell label="Unmet" value={Math.max(0, 150 - progress.length)} tone="muted" />
        </div>

        <Link
          to="/vocabulary"
          className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-cinnabar"
        >
          <BookText className="h-4 w-4" strokeWidth={1.6} />
          Browse the vocabulary
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </section>

      {newRemaining === 0 && dueCount === 0 && (
        <div className="mt-10 flex items-start gap-3 rounded-lg border border-dashed border-border bg-surface p-5 text-sm text-muted-foreground">
          <Sparkles className="mt-0.5 h-4 w-4 text-cinnabar" />
          <p>
            You've met your daily new-word target. Rest, or head into{" "}
            <Link to="/study" className="text-cinnabar underline-offset-4 hover:underline">
              free practice
            </Link>{" "}
            to review at your own pace.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
  icon,
}: {
  label: string;
  value: number | string;
  accent?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div
        className={`mt-1.5 flex items-baseline gap-1.5 font-serif text-2xl ${accent ? "text-cinnabar" : ""}`}
      >
        {icon}
        {value}
      </div>
    </div>
  );
}

function LibCell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "amber" | "ink" | "moss" | "muted";
}) {
  const dot = {
    amber: "bg-amber",
    ink: "bg-foreground",
    moss: "bg-moss",
    muted: "bg-muted-foreground/40",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        {label}
      </div>
      <div className="mt-1.5 font-serif text-2xl">{value}</div>
    </div>
  );
}
