# Tasks

Bugs, features, and quality-of-life improvements found in the codebase.

---

## Bugs

### B-1 · Double-advance race on "Next card" (Easy)
**File:** `study.tsx` — `advance()`  
`advance()` is async with no in-flight guard. Pressing Enter while the mouse is on the "Next card" button can fire it twice, inflating session summary counts. Fix: add an `advancingRef = useRef(false)` guard.

### B-2 · New words not found when no default list is set (Easy)
**File:** `queries.ts` — `buildStudyQueue()`  
When `defaultListId` is null, the fallback query has no `.order()` and only fetches `remainingNew * 3` rows. If the user has already seen those rows, no new words are returned even though unseen words exist. Fix: add `.order("simplified")` and filter with `NOT IN (seenIds)` at the DB level.

### B-3 · Streak breaks for users with >60 sessions (Easy)
**File:** `queries.ts` — `sessionsQuery`  
Hard limit of 60 sessions ordered newest-first. At 3 sessions/day that's only 20 days of history. `computeStreak` sees a fake gap and caps the streak. Fix: increase the limit to 120+ or query by date range instead.

### B-4 · Timezone-broken "today" boundaries (Medium)
**Files:** `queries.ts` line 83, `dashboard.tsx` line 23  
`new Date().setHours(0,0,0,0)` produces local midnight serialised to UTC. Users in timezones like UTC+8 see yesterday's UTC afternoon counted as today, inflating `newDoneToday` and blocking new words. All date boundaries should use UTC (`new Date().toISOString().slice(0,10)`).

### B-5 · Per-dimension progress columns never written (Easy)
**File:** `study.tsx` — `advance()`  
`user_word_progress` has `pronunciation_correct_count` / `meaning_correct_count` (etc.) columns that are always 0. The `assessment` object is available right there — these fields just need to be written.

### B-6 · `incorrect_count` understates errors (Easy)
**File:** `study.tsx` line 236  
`incorrect_count` only increments for `rating === "again"`. A "hard" rating (one dimension wrong) doesn't count. Fix: increment when `rating === "again" || rating === "hard"`.

### B-7 · `supabase.auth.getUser()` called on every card advance (Easy)
**File:** `study.tsx` — `advance()`  
A network call is made on every card to fetch the user. The user is already verified by `_authenticated`'s `beforeLoad`. Store the user ID in a ref at session start instead.

### B-8 · Failed session insert silently drops final stats (Easy)
**File:** `study.tsx` lines 102–109  
If the `study_sessions` insert fails, `sessionIdRef.current` stays null. At session end the `if (sessionIdRef.current)` guard silently skips writing completed-at and all stats with no error shown.

### B-9 · Overlapping audio when playing quickly (Easy)
**File:** `audio.ts` lines 29–36  
Each `playChinese` call using an `audioUrl` creates a new `Audio` instance without stopping the previous one. Fix: keep a module-level `currentAudio` reference and call `.pause()` before creating a new one.

### B-10 · `"easy"` SRS rating is unreachable dead code (Easy)
**Files:** `srs.ts`, `study.tsx` — `assessmentToRating()`  
`assessmentToRating` can only return `"again"`, `"hard"`, or `"good"`. The `"easy"` path in `schedule()` is never triggered, so `ease_factor` can never increase. Either expose a "Very easy" button or remove the dead branch.

### B-11 · `"hard"` and `"good"` produce identical results for new words (Easy)
**File:** `srs.ts` lines 59–65  
For a brand-new word, both ratings produce `interval_days = 1` and `status = "review"` due to clamping. `"hard"` on a new word should keep `status = "learning"` so it reappears sooner.

### B-12 · `qc.invalidateQueries()` with no argument nukes all caches (Easy)
**File:** `study.tsx` line 257  
At session end, all queries (including `words` and `lists` which didn't change) are invalidated. Fix: invalidate only `["user_word_progress"]` and `["study_sessions"]`.

### B-13 · Signup navigates to dashboard before email is confirmed (Easy)
**File:** `auth.tsx`  
After `supabase.auth.signUp()` the app immediately navigates to `/dashboard`. If email confirmation is enabled in Supabase, the user arrives at a broken session. Should check `data.session` and show a "check your email" message when null.

### B-14 · Free practice link in dashboard bypasses type-safe router (Easy)
**File:** `dashboard.tsx` line 124  
`<Link to="/study?mode=free">` uses a raw string instead of `search={{ mode: "free" }}`. If the search schema changes this link silently breaks. Use the typed form as done in `DoneStep`.

---

## Features

### ~~F-1 · Undo / correct last answer~~ ✓ done
~~No way to go back after a mis-tap on pronunciation or meaning. A "go back" button on the reference card (before pressing "Next") would cover the most common accidental-tap case.~~

### ~~F-2 · Configurable free practice session length~~ ✓ done
~~The 20-card cap is hardcoded in `buildFreePracticeQueue`. Add a setting or respect `daily_new_word_target` as the cap.~~

### ~~F-3 · Sync character size preference to Supabase~~ ✓ done (pending DB migration)
~~Character size lives in `localStorage` only and is lost on a new device or browser. Adding a column to `user_settings` and writing it alongside the other settings on save would fix this.~~
> Migration `supabase/migrations/20260727000001_add_char_size_and_free_practice_length.sql` needs to be applied via Supabase SQL Editor. Until then the app falls back to localStorage gracefully.

### F-4 · Word detail / drill-down in vocabulary (Medium)
Vocabulary rows are inert beyond audio playback. Clicking a row could open a panel showing the SRS schedule (next due date, current interval, ease factor, review history). All data is already in `progressByWord`.

### F-5 · Sign-out accessible on mobile (Easy)
**File:** `app-shell.tsx`  
`NAV.slice(0, 5)` omits the Account item from the mobile bottom nav. Mobile users have no sign-out button. Fix: include Account in the mobile nav or add a sign-out option in the mobile header.

### F-6 · Wire up `streak_enabled` DB column (Easy)
`user_settings.streak_enabled` exists in the schema but is never read or written. Either expose it as a toggle in settings or remove the column.

---

## Quality of Life

### Q-1 · Audio speed test button in settings (Easy)
The speed slider has no audible preview. Add a small play button next to it that plays a sample word (e.g. 你好) at the current speed.

### Q-2 · Vocabulary list sort control (Easy)
The list is always sorted alphabetically. A sort dropdown (by status, due date, last reviewed) would make the page useful for targeted review.

### Q-3 · Dashboard "Unmet" uses hardcoded 150 (Easy)
**File:** `dashboard.tsx` line 106  
`Math.max(0, 150 - progress.length)` breaks if the word count changes. Use `words.length` from `wordsQuery` instead.

### Q-4 · Progress chart bar tooltip doesn't work on touch (Easy)
**File:** `progress.tsx`  
`title="..."` native tooltips don't fire on mobile. Replace with a hover/focus state that renders an absolutely-positioned label, or use the existing `tooltip.tsx` component.

### Q-5 · "Words in study" stat has no total denominator (Easy)
**File:** `progress.tsx`  
Shows `47` with no context. Change to `47 / 150` (or use `words.length` dynamically).

### Q-6 · AudioButton "playing" highlight resets too early (Easy)
**File:** `audio-button.tsx`  
`setTimeout(..., 400)` dismisses the playing state while audio is still playing for longer words. For the `Audio` path, listen to the `'ended'` event instead.

### Q-7 · Reviews appear as a solid block before new words (Easy)
**File:** `study.tsx`  
All due reviews always appear first. Interleaving new-word batches within the review queue (e.g. every 4th card) would make long sessions feel less monotonous.

### Q-8 · No back navigation on mobile for most pages (Easy)
**File:** `app-shell.tsx`  
The mobile top bar shows only the brand name. Pages like settings, progress, and account have no back affordance. Show the current page label and a back arrow in the mobile header.

### Q-9 · No "leave session?" confirmation (Easy)
**File:** `study.tsx`  
The "Back" link at the top of study navigates away immediately, discarding unsaved card progress. A `beforeLeave` guard or `beforeunload` handler should prompt before discarding.

### Q-10 · `readCharSize` validation is incomplete (Easy)
**File:** `char-size.ts` line 20  
The guard `stored === "sm" || stored === "lg"` will silently default any future third option to `"md"`. Use `CHAR_SIZE_OPTIONS.includes(stored as CharSize)` instead.

### Q-11 · SRS status invisible on mobile vocabulary rows (Easy)
**File:** `vocabulary.tsx`  
The status pill is hidden on mobile. A small coloured dot (like the `LibCell` dot in the dashboard) next to the character would convey status without needing an extra column.

### Q-12 · No visual feedback when intro card audio is loading (Easy)
**File:** `study.tsx` — `IntroStep`  
`playChinese` is called on mount but there is no visual cue that audio is loading or playing. Apply the same `playing` state pattern used in `AudioButton`.
