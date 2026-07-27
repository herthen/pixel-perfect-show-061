import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { z } from "zod";
import { ArrowLeft, Check, X, Volume2 } from "lucide-react";
import {
  buildFreePracticeQueue,
  buildStudyQueue,
  type ProgressRow,
  type WordRow,
} from "@/lib/queries";
import {
  type CharSize,
  CHAR_SIZES,
  readCharSize,
} from "@/lib/char-size";
import { supabase } from "@/integrations/supabase/client";
import {
  assessmentToRating,
  schedule,
  type AssessmentResult,
  type ProgressStatus,
} from "@/lib/srs";
import { playChinese } from "@/lib/audio";

const studySearch = z.object({
  mode: z.enum(["free"]).optional(),
});

export const Route = createFileRoute("/_authenticated/study")({
  ssr: false,
  validateSearch: studySearch,
  component: StudyPage,
});

type Card = WordRow & { progress: ProgressRow | null };

type QueueItem = { type: "quiz" | "intro"; card: Card };

type Phase =
  | { name: "loading" }
  | { name: "empty" }
  | { name: "introduce"; card: Card; index: number }
  | { name: "prompt"; card: Card; index: number }
  | { name: "pronounce"; card: Card; index: number }
  | { name: "meaning"; card: Card; index: number; pronunciation: "known" | "unknown" }
  | { name: "reference"; card: Card; index: number; assessment: AssessmentResult }
  | { name: "done"; summary: { correct: number; total: number; newWords: number } };

const DEFAULT_EF = 2.5;

function StudyPage() {
  const qc = useQueryClient();
  const { mode } = Route.useSearch();
  const freePractice = mode === "free";
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [audioSpeed, setAudioSpeed] = useState(0.85);
  const [charSize, setCharSize] = useState<CharSize>(readCharSize);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === "study_char_size") setCharSize(readCharSize());
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  const sessionIdRef = useRef<string | null>(null);
  const startedAtRef = useRef<string>(new Date().toISOString());
  const statsRef = useRef({ correct: 0, total: 0, newWords: 0, reviews: 0 });

  useEffect(() => {
    (async () => {
      const [queueResult, settings] = await Promise.all([
        freePractice ? buildFreePracticeQueue() : buildStudyQueue(),
        supabase.from("user_settings").select("preferred_audio_speed").maybeSingle(),
      ]);
      setAudioSpeed(settings.data?.preferred_audio_speed ?? 0.85);
      const { cards } = queueResult;
      if (cards.length === 0) {
        setPhase({ name: "empty" });
        return;
      }

      let items: QueueItem[];
      if (freePractice) {
        items = cards.map((c) => ({ type: "quiz" as const, card: c }));
      } else {
        const reviewsDue = "reviewsDue" in queueResult ? queueResult.reviewsDue : 0;
        const reviewCards = cards.slice(0, reviewsDue);
        const newCards = cards.slice(reviewsDue);
        items = reviewCards.map((c) => ({ type: "quiz" as const, card: c }));
        for (let i = 0; i < newCards.length; i += 3) {
          const batch = newCards.slice(i, i + 3);
          batch.forEach((c) => items.push({ type: "intro" as const, card: c }));
          batch.forEach((c) => items.push({ type: "quiz" as const, card: c }));
        }
      }

      if (!freePractice) {
        const user = (await supabase.auth.getUser()).data.user!;
        const { data: session } = await supabase
          .from("study_sessions")
          .insert({ started_at: startedAtRef.current, user_id: user.id })
          .select("id")
          .single();
        sessionIdRef.current = session?.id ?? null;
      }

      setQueue(items);
      const first = items[0];
      setPhase(
        first.type === "intro"
          ? { name: "introduce", card: first.card, index: 0 }
          : { name: "prompt", card: first.card, index: 0 }
      );
    })().catch((e) => {
      console.error(e);
      toast.error("Couldn't load your session");
      setPhase({ name: "empty" });
    });
  }, [freePractice]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const p = phase;
      if (p.name === "introduce") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          advanceIntro(p.index);
        }
      } else if (p.name === "prompt") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          setPhase({ name: "pronounce", card: p.card, index: p.index });
        }
        if (e.key.toLowerCase() === "s") {
          playChinese({
            text: p.card.simplified,
            audioUrl: p.card.audio_url,
            rate: audioSpeed,
          });
        }
      } else if (p.name === "pronounce") {
        if (e.key === "1" || e.key === "ArrowLeft" || e.key.toLowerCase() === "n") {
          e.preventDefault();
          answerPronunciation(p, "unknown");
        }
        if (e.key === "2" || e.key === "ArrowRight" || e.key.toLowerCase() === "y" || e.key === "Enter") {
          e.preventDefault();
          answerPronunciation(p, "known");
        }
      } else if (p.name === "meaning") {
        if (e.key === "1" || e.key === "ArrowLeft" || e.key.toLowerCase() === "n") {
          e.preventDefault();
          answerMeaning(p, "unknown");
        }
        if (e.key === "2" || e.key === "ArrowRight" || e.key.toLowerCase() === "y" || e.key === "Enter") {
          e.preventDefault();
          answerMeaning(p, "known");
        }
      } else if (p.name === "reference") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          advance();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, audioSpeed]);

  function answerPronunciation(p: Extract<Phase, { name: "pronounce" }>, ans: "known" | "unknown") {
    setPhase({ name: "meaning", card: p.card, index: p.index, pronunciation: ans });
  }

  function answerMeaning(p: Extract<Phase, { name: "meaning" }>, ans: "known" | "unknown") {
    const assessment: AssessmentResult = { pronunciation: p.pronunciation, meaning: ans };
    setPhase({ name: "reference", card: p.card, index: p.index, assessment });
    playChinese({
      text: p.card.simplified,
      audioUrl: p.card.audio_url,
      rate: audioSpeed,
    });
  }

  function advanceIntro(index: number) {
    const nextIndex = index + 1;
    if (nextIndex >= queue.length) return;
    const item = queue[nextIndex];
    setPhase(
      item.type === "intro"
        ? { name: "introduce", card: item.card, index: nextIndex }
        : { name: "prompt", card: item.card, index: nextIndex }
    );
  }

  async function advance() {
    if (phase.name !== "reference") return;
    const { card, index, assessment } = phase;
    const rating = assessmentToRating(assessment);
    const isNew = card.progress === null;

    const current = {
      ease_factor: card.progress?.ease_factor ?? DEFAULT_EF,
      interval_days: card.progress?.interval_days ?? 0,
      repetitions: card.progress?.repetitions ?? 0,
      status: (card.progress?.status as ProgressStatus | undefined) ?? "new",
    };
    const next = schedule(current, rating);

    statsRef.current.total += 1;
    if (rating === "good" || rating === "easy") statsRef.current.correct += 1;
    if (isNew) statsRef.current.newWords += 1;
    else statsRef.current.reviews += 1;

    if (!freePractice) {
      const user = (await supabase.auth.getUser()).data.user!;
      const { error } = await supabase.from("user_word_progress").upsert(
        {
          user_id: user.id,
          word_id: card.id,
          ease_factor: next.ease_factor,
          interval_days: next.interval_days,
          repetitions: next.repetitions,
          status: next.status,
          due_at: next.due_at,
          last_reviewed_at: new Date().toISOString(),
          review_count: (card.progress?.review_count ?? 0) + 1,
          correct_count:
            (card.progress?.correct_count ?? 0) + (rating === "good" || rating === "easy" ? 1 : 0),
          incorrect_count:
            (card.progress?.incorrect_count ?? 0) + (rating === "again" ? 1 : 0),
        },
        { onConflict: "user_id,word_id" },
      );
      if (error) console.error(error);
    }

    const nextIndex = index + 1;
    if (nextIndex >= queue.length) {
      if (sessionIdRef.current) {
        await supabase
          .from("study_sessions")
          .update({
            completed_at: new Date().toISOString(),
            reviewed_words_count: statsRef.current.total,
            correct_count: statsRef.current.correct,
            incorrect_count: statsRef.current.total - statsRef.current.correct,
            new_words_count: statsRef.current.newWords,
          })
          .eq("id", sessionIdRef.current);
      }
      if (!freePractice) qc.invalidateQueries();
      setPhase({
        name: "done",
        summary: {
          correct: statsRef.current.correct,
          total: statsRef.current.total,
          newWords: statsRef.current.newWords,
        },
      });
    } else {
      const nextItem = queue[nextIndex];
      setPhase(
        nextItem.type === "intro"
          ? { name: "introduce", card: nextItem.card, index: nextIndex }
          : { name: "prompt", card: nextItem.card, index: nextIndex }
      );
    }
  }

  const progress = useMemo(() => {
    if (
      phase.name === "introduce" ||
      phase.name === "prompt" ||
      phase.name === "pronounce" ||
      phase.name === "meaning" ||
      phase.name === "reference"
    ) {
      return { current: phase.index + 1, total: queue.length };
    }
    return null;
  }, [phase, queue.length]);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        {progress && (
          <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
            Card {progress.current} of {progress.total}
          </div>
        )}
      </div>

      {progress && (
        <div className="mt-4 h-[2px] w-full overflow-hidden rounded-full bg-border">
          <div
            className="h-full bg-cinnabar transition-[width] duration-300"
            style={{ width: `${(progress.current / progress.total) * 100}%` }}
          />
        </div>
      )}

      {freePractice && (
        <div className="mt-4 rounded-lg border border-dashed border-border bg-surface p-4 text-sm text-muted-foreground">
          Free practice mode — this session will not update your spaced repetition progress.
        </div>
      )}

      <div className="mt-14 md:mt-20">
        {phase.name === "loading" && (
          <div className="py-24 text-center text-sm text-muted-foreground">
            Setting up your desk…
          </div>
        )}

        {phase.name === "empty" && <EmptyState />}

        {phase.name === "introduce" && (
          <IntroStep
            card={phase.card}
            audioSpeed={audioSpeed}
            charSize={charSize}
            onNext={() => advanceIntro(phase.index)}
          />
        )}

        {phase.name === "prompt" && (
          <PromptStep
            card={phase.card}
            freePractice={freePractice}
            charSize={charSize}
            onReveal={() => setPhase({ name: "pronounce", card: phase.card, index: phase.index })}
          />
        )}

        {phase.name === "pronounce" && (
          <QuestionStep
            card={phase.card}
            question="Do you know the pronunciation?"
            charSize={charSize}
            onYes={() => answerPronunciation(phase, "known")}
            onNo={() => answerPronunciation(phase, "unknown")}
          />
        )}

        {phase.name === "meaning" && (
          <>
            <RevealPinyin card={phase.card} audioSpeed={audioSpeed} charSize={charSize} />
            <QuestionStep
              card={phase.card}
              question="Do you know what it means?"
              charSize={charSize}
              onYes={() => answerMeaning(phase, "known")}
              onNo={() => answerMeaning(phase, "unknown")}
              subtle
            />
          </>
        )}

        {phase.name === "reference" && (
          <ReferenceStep
            card={phase.card}
            onNext={advance}
            audioSpeed={audioSpeed}
            charSize={charSize}
            assessment={phase.assessment}
            freePractice={freePractice}
          />
        )}

        {phase.name === "done" && <DoneStep summary={phase.summary} freePractice={freePractice} />}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface p-10 text-center">
      <div className="mx-auto mb-4 ink-mark" />
      <h2 className="font-serif text-2xl">Nothing to study right now</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        You're caught up. Head back to your desk or raise your daily target in Settings.
      </p>
      <div className="mt-6 flex justify-center gap-2">
        <Link
          to="/dashboard"
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-accent"
        >
          Back to dashboard
        </Link>
        <Link
          to="/settings"
          className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
        >
          Adjust settings
        </Link>
      </div>
    </div>
  );
}

function IntroStep({
  card,
  audioSpeed,
  charSize,
  onNext,
}: {
  card: Card;
  audioSpeed: number;
  charSize: CharSize;
  onNext: () => void;
}) {
  useEffect(() => {
    playChinese({ text: card.simplified, audioUrl: card.audio_url, rate: audioSpeed });
  }, [card.id]);

  return (
    <div>
      <div className="rounded-lg border border-cinnabar/20 bg-surface p-8 md:p-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-cinnabar">New word</div>
            <div
              className="mt-3 font-cjk leading-none text-foreground"
              style={{ fontSize: CHAR_SIZES[charSize].card }}
            >
              {card.simplified}
            </div>
          </div>
          <button
            onClick={() =>
              playChinese({ text: card.simplified, audioUrl: card.audio_url, rate: audioSpeed })
            }
            className="rounded-md border border-border bg-background p-2 text-muted-foreground hover:text-foreground"
            aria-label="Play audio"
          >
            <Volume2 className="h-5 w-5" />
          </button>
        </div>

        <dl className="mt-8 space-y-4 text-sm">
          <Field label="Pinyin">
            <span className="font-serif text-lg italic text-cinnabar">{card.pinyin}</span>
          </Field>
          <Field label="Meaning">
            <span className="font-serif text-lg text-foreground">{card.english_meaning}</span>
          </Field>
          {card.part_of_speech && <Field label="Part of speech">{card.part_of_speech}</Field>}
          {card.example_sentence && (
            <Field label="Example">
              <div className="space-y-1">
                <div className="font-cjk text-base text-foreground">{card.example_sentence}</div>
                {card.example_translation && (
                  <div className="text-muted-foreground">{card.example_translation}</div>
                )}
              </div>
            </Field>
          )}
        </dl>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Take a moment to study this word.{" "}
          <kbd className="rounded border border-border px-1.5 py-0.5">Space</kbd> when ready.
        </p>
        <button
          onClick={onNext}
          className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Got it →
        </button>
      </div>
    </div>
  );
}

function PromptStep({
  card,
  freePractice,
  charSize,
  onReveal,
}: {
  card: Card;
  freePractice: boolean;
  charSize: CharSize;
  onReveal: () => void;
}) {
  return (
    <div className="flex flex-col items-center">
      <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {card.progress ? "Review" : freePractice ? "Practice" : "New word"}
      </div>
      <div
        className="mt-6 font-cjk leading-none text-foreground"
        style={{ fontSize: CHAR_SIZES[charSize].prompt }}
      >
        {card.simplified}
      </div>
      <p className="mt-8 text-sm text-muted-foreground">
        Take a moment. When you're ready, reveal.
      </p>
      <button
        onClick={onReveal}
        className="mt-6 rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Reveal
      </button>
      <p className="mt-3 text-[11px] text-muted-foreground/70">
        <kbd className="rounded border border-border px-1.5 py-0.5">Space</kbd> to reveal ·
        <kbd className="ml-1.5 rounded border border-border px-1.5 py-0.5">S</kbd> to play sound
      </p>
    </div>
  );
}

function QuestionStep({
  card,
  question,
  charSize,
  onYes,
  onNo,
  subtle = false,
}: {
  card: Card;
  question: string;
  charSize: CharSize;
  onYes: () => void;
  onNo: () => void;
  subtle?: boolean;
}) {
  return (
    <div className={`flex flex-col items-center ${subtle ? "mt-8" : ""}`}>
      {!subtle && (
        <div
          className="font-cjk leading-none text-foreground"
          style={{ fontSize: CHAR_SIZES[charSize].question }}
        >
          {card.simplified}
        </div>
      )}
      <p className="mt-8 font-serif text-xl text-foreground">{question}</p>
      <div className="mt-6 flex gap-3">
        <button
          onClick={onNo}
          className="flex min-w-[10rem] items-center justify-center gap-2 rounded-md border border-border bg-surface px-6 py-3 text-sm text-foreground hover:border-cinnabar/50"
        >
          <X className="h-4 w-4 text-cinnabar" />
          Not yet
        </button>
        <button
          onClick={onYes}
          className="flex min-w-[10rem] items-center justify-center gap-2 rounded-md bg-primary px-6 py-3 text-sm text-primary-foreground hover:opacity-90"
        >
          <Check className="h-4 w-4" />
          I know it
        </button>
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground/70">
        <kbd className="rounded border border-border px-1.5 py-0.5">←</kbd> not yet ·{" "}
        <kbd className="rounded border border-border px-1.5 py-0.5">→</kbd> know it
      </p>
    </div>
  );
}

function RevealPinyin({ card, audioSpeed, charSize }: { card: Card; audioSpeed: number; charSize: CharSize }) {
  useEffect(() => {
    playChinese({ text: card.simplified, audioUrl: card.audio_url, rate: audioSpeed });
  }, [card.id]);
  return (
    <div className="flex flex-col items-center">
      <div
        className="font-cjk leading-none text-foreground"
        style={{ fontSize: CHAR_SIZES[charSize].card }}
      >
        {card.simplified}
      </div>
      <div className="mt-4 flex items-center gap-3">
        <span className="font-serif text-2xl italic text-cinnabar">{card.pinyin}</span>
        <button
          onClick={() =>
            playChinese({ text: card.simplified, audioUrl: card.audio_url, rate: audioSpeed })
          }
          aria-label="Play again"
          className="rounded-md border border-border bg-surface p-1.5 text-muted-foreground hover:text-foreground"
        >
          <Volume2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ReferenceStep({
  card,
  onNext,
  audioSpeed,
  charSize,
  assessment,
  freePractice,
}: {
  card: Card;
  onNext: () => void;
  audioSpeed: number;
  charSize: CharSize;
  assessment: AssessmentResult;
  freePractice: boolean;
}) {
  const both = assessment.pronunciation === "known" && assessment.meaning === "known";
  const none = assessment.pronunciation === "unknown" && assessment.meaning === "unknown";
  return (
    <div>
      <div className="rounded-lg border border-border bg-surface p-8 md:p-10">
        <div className="flex items-start justify-between gap-6">
          <div>
            <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Reference card
            </div>
            <div
              className="mt-3 font-cjk leading-none text-foreground"
              style={{ fontSize: CHAR_SIZES[charSize].card }}
            >
              {card.simplified}
            </div>
          </div>
          <button
            onClick={() =>
              playChinese({ text: card.simplified, audioUrl: card.audio_url, rate: audioSpeed })
            }
            className="rounded-md border border-border bg-background p-2 text-muted-foreground hover:text-foreground"
            aria-label="Replay audio"
          >
            <Volume2 className="h-5 w-5" />
          </button>
        </div>

        <dl className="mt-8 space-y-4 text-sm">
          <Field label="Pinyin">
            <span className="font-serif text-lg italic text-cinnabar">{card.pinyin}</span>
          </Field>
          <Field label="Meaning">
            <span className="font-serif text-lg text-foreground">{card.english_meaning}</span>
          </Field>
          {card.part_of_speech && <Field label="Part of speech">{card.part_of_speech}</Field>}
          {card.example_sentence && (
            <Field label="Example">
              <div className="space-y-1">
                <div className="font-cjk text-base text-foreground">{card.example_sentence}</div>
                {card.example_translation && (
                  <div className="text-muted-foreground">{card.example_translation}</div>
                )}
              </div>
            </Field>
          )}
        </dl>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-xs text-muted-foreground">
          {freePractice
            ? "Keep it up."
            : both
              ? "Nicely done — I'll bring this back further out."
              : none
                ? "That's fine — we'll return to it soon."
                : "Making progress — I'll show this again shortly."}
        </div>
        <button
          onClick={onNext}
          className="rounded-md bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Next card →
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-4 border-t border-border pt-3 first:border-0 first:pt-0">
      <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function DoneStep({
  summary,
  freePractice,
}: {
  summary: { correct: number; total: number; newWords: number };
  freePractice: boolean;
}) {
  const pct = summary.total ? Math.round((summary.correct / summary.total) * 100) : 0;
  return (
    <div className="rounded-lg border border-border bg-surface p-10 text-center">
      <div className="mx-auto mb-4 ink-mark" />
      <h2 className="font-serif text-3xl">Session complete</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {summary.total} card{summary.total === 1 ? "" : "s"} reviewed
        {!freePractice && ` · ${summary.newWords} new`} · {pct}% confident
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link
          to="/dashboard"
          className="rounded-md border border-border bg-surface px-4 py-2 text-sm hover:bg-accent"
        >
          Back to desk
        </Link>
        {freePractice ? (
          <Link
            to="/study"
            search={{ mode: "free" }}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
            reloadDocument
          >
            Practice again
          </Link>
        ) : (
          <Link
            to="/study"
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90"
            reloadDocument
          >
            Study more
          </Link>
        )}
      </div>
    </div>
  );
}
