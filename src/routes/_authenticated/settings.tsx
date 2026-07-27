import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { settingsQuery, listsQuery } from "@/lib/queries";
import { supabase } from "@/integrations/supabase/client";
import {
  type CharSize,
  CHAR_SIZES,
  CHAR_SIZE_OPTIONS,
  CHAR_SIZE_LABELS,
  readCharSize,
  writeCharSize,
} from "@/lib/char-size";

export const Route = createFileRoute("/_authenticated/settings")({
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(settingsQuery());
    context.queryClient.ensureQueryData(listsQuery());
  },
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { data: settings } = useSuspenseQuery(settingsQuery());
  const { data: lists } = useSuspenseQuery(listsQuery());
  const [target, setTarget] = useState(settings?.daily_new_word_target ?? 5);
  const [speed, setSpeed] = useState(settings?.preferred_audio_speed ?? 0.85);
  const [listId, setListId] = useState<string>(settings?.default_list_id ?? "");
  const [saving, setSaving] = useState(false);
  const [charSize, setCharSizeState] = useState<CharSize>(readCharSize);

  useEffect(() => {
    setTarget(settings?.daily_new_word_target ?? 5);
    setSpeed(settings?.preferred_audio_speed ?? 0.85);
    setListId(settings?.default_list_id ?? "");
  }, [settings]);

  function handleCharSize(size: CharSize) {
    setCharSizeState(size);
    writeCharSize(size);
  }

  async function save() {
    setSaving(true);
    try {
      const user = (await supabase.auth.getUser()).data.user!;
      const { error } = await supabase
        .from("user_settings")
        .upsert(
          {
            user_id: user.id,
            daily_new_word_target: target,
            preferred_audio_speed: speed,
            default_list_id: listId || null,
          },
          { onConflict: "user_id" },
        );
      if (error) throw error;
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["user_settings"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Preferences</p>
      <h1 className="mt-2 font-serif text-4xl">Settings</h1>

      <div className="mt-8 space-y-8 rounded-lg border border-border bg-surface p-6 md:p-8">
        <div>
          <label className="block">
            <span className="text-sm font-medium">Daily new words</span>
            <p className="mt-1 text-xs text-muted-foreground">
              How many new words to introduce each day. Reviews are always shown when they're due.
            </p>
            <div className="mt-4 flex items-center gap-4">
              <input
                type="range"
                min={1}
                max={30}
                value={target}
                onChange={(e) => setTarget(Number(e.target.value))}
                className="flex-1 accent-[--cinnabar]"
              />
              <div className="w-14 rounded-md border border-border bg-background px-2 py-1 text-center font-serif text-lg">
                {target}
              </div>
            </div>
          </label>
        </div>

        <div className="border-t border-border pt-6">
          <label className="block">
            <span className="text-sm font-medium">Audio playback speed</span>
            <p className="mt-1 text-xs text-muted-foreground">
              A slower rate helps you catch tones.
            </p>
            <div className="mt-4 flex items-center gap-4">
              <input
                type="range"
                min={0.6}
                max={1.2}
                step={0.05}
                value={speed}
                onChange={(e) => setSpeed(Number(e.target.value))}
                className="flex-1 accent-[--cinnabar]"
              />
              <div className="w-14 rounded-md border border-border bg-background px-2 py-1 text-center font-serif text-lg">
                {speed.toFixed(2)}×
              </div>
            </div>
          </label>
        </div>

        <div className="border-t border-border pt-6">
          <label className="block">
            <span className="text-sm font-medium">Default list</span>
            <p className="mt-1 text-xs text-muted-foreground">
              New words are drawn from this list first.
            </p>
            <select
              value={listId}
              onChange={(e) => setListId(e.target.value)}
              className="mt-3 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Any word</option>
              {lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="border-t border-border pt-6">
          <span className="text-sm font-medium">Character size</span>
          <p className="mt-1 text-xs text-muted-foreground">
            How large Chinese characters appear during study sessions.
          </p>
          <div className="mt-4 flex items-center gap-4">
            <input
              type="range"
              min={0}
              max={2}
              step={1}
              value={CHAR_SIZE_OPTIONS.indexOf(charSize)}
              onChange={(e) => handleCharSize(CHAR_SIZE_OPTIONS[Number(e.target.value)])}
              aria-label="Character size"
              className="flex-1 accent-[--cinnabar]"
            />
            <div className="w-20 rounded-md border border-border bg-background px-2 py-1 text-center text-sm">
              {CHAR_SIZE_LABELS[charSize]}
            </div>
          </div>
          <div className="mt-4 flex items-center justify-center rounded-lg border border-border bg-background p-6">
            <div className="text-center">
              <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                Preview
              </div>
              <div
                className="font-cjk leading-none text-foreground transition-[font-size] duration-200"
                style={{ fontSize: CHAR_SIZES[charSize].prompt }}
              >
                好
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end border-t border-border pt-6">
          <button
            onClick={save}
            disabled={saving}
            className="rounded-md bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
