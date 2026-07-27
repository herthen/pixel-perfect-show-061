export type CharSize = "sm" | "md" | "lg";

export const CHAR_SIZES: Record<CharSize, { prompt: string; card: string; question: string }> = {
  sm: { prompt: "5rem",  card: "3.5rem", question: "4.5rem" },
  md: { prompt: "9rem",  card: "6rem",   question: "7rem"   },
  lg: { prompt: "13rem", card: "8.5rem", question: "10rem"  },
};

export const CHAR_SIZE_OPTIONS: CharSize[] = ["sm", "md", "lg"];
export const CHAR_SIZE_LABELS: Record<CharSize, string> = {
  sm: "Small",
  md: "Medium",
  lg: "Large",
};

const STORAGE_KEY = "study_char_size";

export function readCharSize(): CharSize {
  const stored = typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
  return stored === "sm" || stored === "lg" ? stored : "md";
}

export function writeCharSize(size: CharSize): void {
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, size);
}
