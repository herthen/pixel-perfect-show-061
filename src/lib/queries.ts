import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { queryOptions } from "@tanstack/react-query";

export type WordRow = Database["public"]["Tables"]["words"]["Row"];
export type ListRow = Database["public"]["Tables"]["lists"]["Row"];
export type ProgressRow = Database["public"]["Tables"]["user_word_progress"]["Row"];
export type SettingsRow = Database["public"]["Tables"]["user_settings"]["Row"];
export type SessionRow = Database["public"]["Tables"]["study_sessions"]["Row"];

export const listsQuery = () =>
  queryOptions({
    queryKey: ["lists"],
    queryFn: async () => {
      const { data, error } = await supabase.from("lists").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

export const settingsQuery = () =>
  queryOptions({
    queryKey: ["user_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_settings").select("*").maybeSingle();
      if (error) throw error;
      return data as SettingsRow | null;
    },
  });

export const progressQuery = () =>
  queryOptions({
    queryKey: ["user_word_progress"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_word_progress").select("*");
      if (error) throw error;
      return data;
    },
  });

export const wordsQuery = () =>
  queryOptions({
    queryKey: ["words"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("words")
        .select("*, word_lists(list_id, position, lists(id, name, slug))")
        .order("simplified");
      if (error) throw error;
      return data as (WordRow & {
        word_lists: { list_id: string; position: number; lists: ListRow }[];
      })[];
    },
  });

export const sessionsQuery = () =>
  queryOptions({
    queryKey: ["study_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_sessions")
        .select("*")
        .order("started_at", { ascending: false })
        .limit(60);
      if (error) throw error;
      return data as SessionRow[];
    },
  });

/** Build a study queue: overdue → due today → new (up to daily target). */
export async function buildStudyQueue(): Promise<{
  cards: (WordRow & { progress: ProgressRow | null })[];
  newTarget: number;
  newDoneToday: number;
  reviewsDue: number;
}> {
  const [{ data: settings }, { data: progress }, { data: sessions }] = await Promise.all([
    supabase.from("user_settings").select("*").maybeSingle(),
    supabase.from("user_word_progress").select("*"),
    supabase
      .from("study_sessions")
      .select("started_at, new_words_count")
      .gte("started_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
  ]);

  const target = settings?.daily_new_word_target ?? 5;
  const defaultListId = settings?.default_list_id ?? null;
  const now = new Date().toISOString();

  const newDoneToday = (sessions ?? []).reduce((sum, s) => sum + (s.new_words_count ?? 0), 0);
  const remainingNew = Math.max(0, target - newDoneToday);

  const progressByWord = new Map((progress ?? []).map((p) => [p.word_id, p as ProgressRow]));

  // Due review cards
  const dueIds = (progress ?? [])
    .filter((p) => p.due_at <= now && p.status !== "new")
    .sort((a, b) => a.due_at.localeCompare(b.due_at))
    .map((p) => p.word_id);

  let dueWords: WordRow[] = [];
  if (dueIds.length) {
    const { data } = await supabase.from("words").select("*").in("id", dueIds);
    dueWords = data ?? [];
    // preserve due order
    const order = new Map(dueIds.map((id, i) => [id, i]));
    dueWords.sort((a, b) => (order.get(a.id)! - order.get(b.id)!));
  }

  // New candidates: not in progress, within default list if any
  const seenIds = new Set((progress ?? []).map((p) => p.word_id));
  let newWords: WordRow[] = [];
  if (remainingNew > 0) {
    if (defaultListId) {
      const { data } = await supabase
        .from("word_lists")
        .select("position, words(*)")
        .eq("list_id", defaultListId)
        .order("position");
      newWords = (data ?? [])
        .map((r) => r.words as unknown as WordRow)
        .filter((w) => w && !seenIds.has(w.id));
      for (let i = newWords.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newWords[i], newWords[j]] = [newWords[j], newWords[i]];
      }
      newWords = newWords.slice(0, remainingNew);
    } else {
      const { data } = await supabase
        .from("words")
        .select("*")
        .limit(remainingNew * 3);
      newWords = (data ?? []).filter((w) => !seenIds.has(w.id));
      for (let i = newWords.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newWords[i], newWords[j]] = [newWords[j], newWords[i]];
      }
      newWords = newWords.slice(0, remainingNew);
    }
  }

  const cards = [
    ...dueWords.map((w) => ({ ...w, progress: progressByWord.get(w.id) ?? null })),
    ...newWords.map((w) => ({ ...w, progress: null })),
  ];

  return {
    cards,
    newTarget: target,
    newDoneToday,
    reviewsDue: dueWords.length,
  };
}

export async function buildFreePracticeQueue(): Promise<{
  cards: (WordRow & { progress: ProgressRow | null })[];
}> {
  const [{ data: settings }, { data: progress }] = await Promise.all([
    supabase.from("user_settings").select("*").maybeSingle(),
    supabase.from("user_word_progress").select("*"),
  ]);

  const defaultListId = settings?.default_list_id ?? null;
  const progressByWord = new Map((progress ?? []).map((p) => [p.word_id, p as ProgressRow]));

  let words: WordRow[] = [];
  if (defaultListId) {
    const { data } = await supabase
      .from("word_lists")
      .select("position, words(*)")
      .eq("list_id", defaultListId)
      .order("position");
    words = (data ?? []).map((row) => row.words as unknown as WordRow).filter(Boolean);
  } else {
    const { data } = await supabase.from("words").select("*").order("simplified");
    words = data ?? [];
  }

  const cards = words.map((word) => ({
    ...word,
    progress: progressByWord.get(word.id) ?? null,
  }));

  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  return { cards: cards.slice(0, 20) };
}

export function computeStreak(sessions: Pick<SessionRow, "started_at" | "completed_at">[]): number {
  if (!sessions.length) return 0;
  const days = new Set(
    sessions
      .filter((s) => s.completed_at)
      .map((s) => new Date(s.started_at).toISOString().slice(0, 10)),
  );
  let streak = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  // If no session today, start from yesterday (allow today to still count if not done)
  const today = cursor.toISOString().slice(0, 10);
  if (!days.has(today)) cursor.setDate(cursor.getDate() - 1);
  while (days.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
