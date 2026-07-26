import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  progressQuery,
  sessionsQuery,
  computeStreak,
} from "@/lib/queries";

export const Route = createFileRoute("/_authenticated/progress")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(progressQuery());
    context.queryClient.ensureQueryData(sessionsQuery());
  },
  component: ProgressPage,
});

function ProgressPage() {
  const { data: progress } = useSuspenseQuery(progressQuery());
  const { data: sessions } = useSuspenseQuery(sessionsQuery());

  const totals = useMemo(() => {
    const now = new Date().toISOString();
    return {
      total: progress.length,
      learning: progress.filter((p) => p.status === "learning").length,
      review: progress.filter((p) => p.status === "review").length,
      mastered: progress.filter((p) => p.status === "mastered").length,
      dueNow: progress.filter((p) => p.due_at <= now && p.status !== "new").length,
    };
  }, [progress]);

  const last30 = useMemo(() => {
    const days: { date: string; count: number; correct: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const day = sessions.filter((s) => s.started_at.slice(0, 10) === key);
      const count = day.reduce((sum, s) => sum + (s.reviewed_words_count ?? 0), 0);
      const correct = day.reduce((sum, s) => sum + (s.correct_count ?? 0), 0);
      days.push({ date: key, count, correct });
    }
    return days;
  }, [sessions]);

  const max = Math.max(1, ...last30.map((d) => d.count));
  const streak = computeStreak(sessions);
  const totalReviews = sessions.reduce((s, x) => s + (x.reviewed_words_count ?? 0), 0);
  const totalCorrect = sessions.reduce((s, x) => s + (x.correct_count ?? 0), 0);
  const accuracy = totalReviews ? Math.round((totalCorrect / totalReviews) * 100) : 0;

  return (
    <div className="mx-auto max-w-4xl">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Your practice</p>
      <h1 className="mt-2 font-serif text-4xl">Progress</h1>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Words in study" value={totals.total} />
        <Stat label="Mastered" value={totals.mastered} accent />
        <Stat label="Current streak" value={`${streak}d`} />
        <Stat label="Accuracy" value={`${accuracy}%`} />
      </div>

      <section className="mt-10 rounded-lg border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-lg">Last 30 days</h2>
          <div className="text-xs text-muted-foreground">
            {last30.filter((d) => d.count > 0).length} active days
          </div>
        </div>
        <div className="mt-5 flex h-32 items-end gap-1">
          {last30.map((d) => (
            <div
              key={d.date}
              className="group relative flex-1"
              title={`${d.date}: ${d.count} cards`}
            >
              <div
                className="w-full rounded-sm bg-cinnabar/70 transition-colors hover:bg-cinnabar"
                style={{ height: `${(d.count / max) * 100}%`, minHeight: d.count > 0 ? 4 : 1 }}
              />
              {d.count === 0 && (
                <div className="absolute bottom-0 h-[1px] w-full bg-border" />
              )}
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>{last30[0].date.slice(5)}</span>
          <span>{last30[last30.length - 1].date.slice(5)}</span>
        </div>
      </section>

      <section className="mt-8 rounded-lg border border-border bg-surface p-6">
        <h2 className="font-serif text-lg">Library composition</h2>
        <div className="mt-4 space-y-3">
          <Bar label="Learning" value={totals.learning} total={totals.total} tone="amber" />
          <Bar label="In review" value={totals.review} total={totals.total} tone="ink" />
          <Bar label="Mastered" value={totals.mastered} total={totals.total} tone="moss" />
        </div>
      </section>
    </div>
  );
}

function Stat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-1.5 font-serif text-2xl ${accent ? "text-cinnabar" : ""}`}>{value}</div>
    </div>
  );
}

function Bar({
  label,
  value,
  total,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  tone: "amber" | "ink" | "moss";
}) {
  const pct = total ? Math.round((value / total) * 100) : 0;
  const bg = { amber: "bg-amber", ink: "bg-foreground", moss: "bg-moss" }[tone];
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground">
          {value} <span className="text-muted-foreground">· {pct}%</span>
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
        <div className={`h-full ${bg}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
