import { useState } from "react";
import { Volume2 } from "lucide-react";
import { playChinese } from "@/lib/audio";
import { cn } from "@/lib/utils";

interface Props {
  text: string;
  audioUrl?: string | null;
  rate?: number;
  label?: string;
  size?: "sm" | "md";
  className?: string;
}

export function AudioButton({ text, audioUrl, rate, label, size = "md", className }: Props) {
  const [playing, setPlaying] = useState(false);
  const [mode, setMode] = useState<"audio" | "tts" | "unavailable" | null>(null);

  async function onPlay() {
    setPlaying(true);
    const result = await playChinese({
      text,
      audioUrl,
      rate,
      onEnded: () => setPlaying(false),
    });
    setMode(result);
    if (result === "unavailable") setPlaying(false);
  }

  return (
    <button
      type="button"
      onClick={onPlay}
      aria-label={label ?? `Play pronunciation for ${text}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border border-border bg-surface text-muted-foreground transition-colors hover:text-foreground hover:bg-accent",
        size === "sm" ? "h-7 w-7 justify-center" : "h-9 px-3 text-xs",
        playing && "text-cinnabar",
        className,
      )}
    >
      <Volume2 className={size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4"} strokeWidth={1.7} />
      {size !== "sm" && (
        <span>{mode === "tts" ? "Play (browser voice)" : "Play"}</span>
      )}
    </button>
  );
}
