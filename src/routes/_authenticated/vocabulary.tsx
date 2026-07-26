import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { wordsQuery, progressQuery, type ProgressRow } from "@/lib/queries";
import { AudioButton } from "@/components/audio-button";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/vocabulary")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(wordsQuery());
    context.queryClient.ensureQueryData(progressQuery());
  },
  component: VocabularyPage,
});

const FILTERS = [
  { key: "all", label: "All" },
  { key: "new", label: "Unseen" },
  { key: "learning", label: "Learning" },
  { key: "review", label: "Review" },
  { key: "mastered", label: "Mastered" },
] as const;

type Filter = (typeof FILTERS)[number]["key"];

function VocabularyPage() {
  const { data: words } = useSuspenseQuery(wordsQuery());
  const { data: progress } = useSuspenseQuery(progressQuery());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const progressByWord = useMemo(
    () => new Map(progress.map((p) => [p.word_id, p as ProgressRow])),
    [progress],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return words.filter((w) => {
      const p = progressByWord.get(w.id);
      const status: string = p?.status ?? "new";
      if (filter !== "all" && status !== filter) return false;
      if (!q) return true;
      return (
        w.simplified.includes(q) ||
        w.pinyin.toLowerCase().includes(q) ||
        w.english_meaning.toLowerCase().includes(q)
      );
    });
  }, [words, progressByWord, filter, query]);

  const counts = useMemo(() => {
    const c = { all: words.length, new: 0, learning: 0, review: 0, mastered: 0 };
    for (const w of words) {
      const s = progressByWord.get(w.id)?.status ?? "new";
      c[s as keyof typeof c] = (c[s as keyof typeof c] ?? 0) + 1;
    }
    return c;
  }, [words, progressByWord]);

  return (
    <div className="mx-auto max-w-5xl">
      <div>
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Library</p>
        <h1 className="mt-2 font-serif text-4xl">Vocabulary</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {words.length} words available · HSK 1 curated.
        </p>
      </div>

      <div className="mt-8 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search character, pinyin, or meaning…"
            className="w-full rounded-md border border-input bg-surface py-2.5 pl-9 pr-3 text-sm outline-none focus:border-cinnabar/60"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "rounded-md border px-2.5 py-1.5 text-xs transition-colors",
                filter === f.key
                  ? "border-cinnabar/60 bg-cinnabar/10 text-foreground"
                  : "border-border bg-surface text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label} <span className="ml-1 text-muted-foreground/70">{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-border bg-surface">
        <div className="grid grid-cols-[3rem_1fr_1fr_2.5rem] items-center gap-4 border-b border-border px-4 py-2.5 text-[11px] uppercase tracking-wider text-muted-foreground md:grid-cols-[4rem_10rem_1fr_1fr_2.5rem]">
          <div>Word</div>
          <div className="hidden md:block">Pinyin</div>
          <div>Meaning</div>
          <div className="hidden md:block">Status</div>
          <div />
        </div>
        <ul className="divide-y divide-border">
          {filtered.map((w) => {
            const p = progressByWord.get(w.id);
            const status = p?.status ?? "new";
            return (
              <li
                key={w.id}
                className="grid grid-cols-[3rem_1fr_1fr_2.5rem] items-center gap-4 px-4 py-3 hover:bg-accent/40 md:grid-cols-[4rem_10rem_1fr_1fr_2.5rem]"
              >
                <div className="font-cjk text-2xl text-foreground">{w.simplified}</div>
                <div className="hidden font-serif italic text-cinnabar md:block">{w.pinyin}</div>
                <div className="md:hidden">
                  <div className="text-sm text-foreground">{w.english_meaning}</div>
                  <div className="mt-0.5 text-xs italic text-cinnabar">{w.pinyin}</div>
                </div>
                <div className="hidden text-sm text-foreground md:block">{w.english_meaning}</div>
                <div className="hidden md:block">
                  <StatusPill status={status as string} />
                </div>
                <div className="justify-self-end">
                  <AudioButton
                    text={w.simplified}
                    audioUrl={w.audio_url}
                    size="sm"
                    label={`Play ${w.simplified}`}
                  />
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-4 py-10 text-center text-sm text-muted-foreground">
              Nothing matches those filters.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    new: { label: "Unseen", className: "text-muted-foreground bg-muted" },
    learning: { label: "Learning", className: "text-amber bg-amber/10" },
    review: { label: "Review", className: "text-foreground bg-accent" },
    mastered: { label: "Mastered", className: "text-moss bg-moss/10" },
  };
  const s = map[status] ?? map.new;
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] ${s.className}`}>
      {s.label}
    </span>
  );
}
