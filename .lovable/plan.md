## What I'll build

A production-oriented v1 of **Inkstone Chinese** — a Mandarin flashcard app with a sequential self-assessment review flow and spaced repetition, backed by Supabase.

### 1. Backend (Lovable Cloud / Supabase)

Enable Cloud, then a single migration creating:

- `words` (shared vocab: simplified, pinyin, pinyin_numeric, english_meaning, part_of_speech, classifier, example_sentence, example_translation, audio_url, source, source_license…)
- `lists` (name, slug, description, list_type, version)
- `word_lists` (M:N with `position`, unique on `(word_id, list_id)`)
- `user_word_progress` (status enum `new|learning|review|mastered`, ease_factor, interval_days, due_at, repetitions, review/correct/incorrect counts + separate pronunciation & meaning counters; unique on `(user_id, word_id)`)
- `study_sessions` (started_at, completed_at, counts)
- `user_settings` (daily_new_word_target default 5, default_list_id, preferred_audio_speed default 0.85, streak_enabled)
- Trigger on `auth.users` insert → creates default `user_settings` row.

**RLS + grants:** shared `words/lists/word_lists` readable by `authenticated`; personal tables strictly `auth.uid() = user_id`. Explicit `GRANT`s to `authenticated` + `service_role`.

**Seed** (INSERT statements in the migration): full HSK 1 (~150 words) + lists "HSK 1 — 2010", "Greetings", "Everyday basics", "Common verbs" with `word_lists` memberships. Audio URLs left null → browser TTS fallback.

### 2. Auth

Supabase email + password (per the spec — no Google here since the spec calls out email/password). Sign up, sign in, sign out, `/auth` public route, protected app under `_authenticated/`. Account page shows signed-in email.

### 3. Scheduling (isolated module `src/lib/srs.ts`)

SM-2-inspired, pure functions, unit-testable:
- Input: current progress row + rating `again | hard | good | easy`
- Output: next `{ease_factor, interval_days, due_at, repetitions, status}`
- Result mapping: both known → good, one unknown → hard, both unknown → again.

### 4. Sequential review flow (`/study`)

Five card states machine: `pronunciation-question → pronunciation-answer → meaning-question → meaning-answer → complete-card`. Keyboard shortcuts (Space / 1–4). Audio via stored `audio_url` when present, else `SpeechSynthesis` `zh-CN` @ 0.85x. Session summary on completion; results written to `user_word_progress` + `study_sessions`.

### 5. Pages

- `/` Dashboard: greeting, today's new/target, reviews due, streak, primary "Start today's study", secondary "Review due", 7-day activity strip.
- `/study` Learn+Review combined queue (overdue → due today → new up to target).
- `/vocabulary`: search (chinese/pinyin/english), filter by list & status, row audio, expandable full card.
- `/progress`: totals per status, streak, per-list bars, pronunciation vs meaning accuracy.
- `/settings`: daily target, default list, audio speed, sign out.
- `/account`: email + sign out.

### 6. Design system

Update `src/styles.css` tokens to the spec palette:

```text
paper #F7F6F2  surface #FFFFFF  ink #252525  muted #78756F
border #E7E5DF  cinnabar #B64B3A  moss #4F7762  amber #B58A43
```

Inter (UI) + Georgia (occasional serif); CJK fallback stack for Chinese glyphs. Quiet left sidebar (desktop) / bottom nav (mobile) with a small cinnabar ink-mark brand accent. Small radii (~6px), thin borders, no gradients/glass. `prefers-reduced-motion` respected; visible focus rings.

### Technical notes

- TanStack Start (not Next.js). Env vars are the Cloud-managed `VITE_SUPABASE_*` / `SUPABASE_*`, not `NEXT_PUBLIC_*`.
- All queries via TanStack Query with the loader `ensureQueryData` + `useSuspenseQuery` pattern.
- Mutations via `createServerFn` with `requireSupabaseAuth` where user context is needed; public word/list reads use the browser client under RLS (authenticated read policy).
- No hardcoded vocab in components — everything from DB.
- Streak computed from `study_sessions` server-side (simple contiguous-day scan).

### Out of scope for this pass

Custom decks, CC-CEDICT import pipeline, real MP3 assets, guest mode, password reset UI (can be added on request), independent pronunciation/meaning due dates (counters are tracked separately so it can be added later without migration).

Approve and I'll start with the migration + design system, then auth, then the review flow, then the remaining pages.