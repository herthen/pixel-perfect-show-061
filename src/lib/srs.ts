/**
 * SM-2-inspired spaced repetition. Pure, side-effect free.
 * Independently unit-testable — no Supabase, no DOM.
 */

export type Rating = "again" | "hard" | "good" | "easy";
export type ProgressStatus = "new" | "learning" | "review" | "mastered";

export interface ProgressLike {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  status: ProgressStatus;
}

export interface SchedulerResult {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  status: ProgressStatus;
  due_at: string; // ISO
}

export interface AssessmentResult {
  pronunciation: "known" | "unknown";
  meaning: "known" | "unknown";
}

export function assessmentToRating(a: AssessmentResult): Rating {
  const known = (a.pronunciation === "known" ? 1 : 0) + (a.meaning === "known" ? 1 : 0);
  if (known === 2) return "good";
  if (known === 1) return "hard";
  return "again";
}

const MIN_EF = 1.3;
const MAX_EF = 2.8;

function clampEF(ef: number): number {
  return Math.min(MAX_EF, Math.max(MIN_EF, ef));
}

/**
 * Compute the next schedule for a review.
 * `now` is injectable for tests.
 */
export function schedule(current: ProgressLike, rating: Rating, now: Date = new Date()): SchedulerResult {
  let { ease_factor, interval_days, repetitions } = current;
  let status: ProgressStatus = current.status;

  switch (rating) {
    case "again": {
      repetitions = 0;
      interval_days = 0; // due again in ~10 minutes
      ease_factor = clampEF(ease_factor - 0.2);
      status = "learning";
      break;
    }
    case "hard": {
      repetitions = Math.max(1, repetitions);
      ease_factor = clampEF(ease_factor - 0.15);
      interval_days = interval_days <= 0 ? 1 : Math.max(1, Math.round(interval_days * 1.2));
      status = interval_days >= 21 ? "mastered" : "review";
      break;
    }
    case "good": {
      repetitions += 1;
      if (repetitions === 1) interval_days = 1;
      else if (repetitions === 2) interval_days = 3;
      else interval_days = Math.max(1, Math.round(interval_days * ease_factor));
      status = interval_days >= 21 ? "mastered" : "review";
      break;
    }
    case "easy": {
      repetitions += 1;
      ease_factor = clampEF(ease_factor + 0.15);
      if (repetitions === 1) interval_days = 3;
      else interval_days = Math.max(1, Math.round(interval_days * ease_factor * 1.3));
      status = interval_days >= 21 ? "mastered" : "review";
      break;
    }
  }

  const due = new Date(now);
  if (interval_days <= 0) {
    // reschedule shortly (10 minutes) while learning
    due.setMinutes(due.getMinutes() + 10);
  } else {
    due.setDate(due.getDate() + interval_days);
  }

  return {
    ease_factor,
    interval_days,
    repetitions,
    status,
    due_at: due.toISOString(),
  };
}
