import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account")({
  ssr: false,
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string>("");
  const [joined, setJoined] = useState<string>("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setEmail(data.user.email ?? "");
        setJoined(data.user.created_at ?? "");
      }
    });
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/", replace: true });
  }

  return (
    <div className="mx-auto max-w-2xl">
      <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">You</p>
      <h1 className="mt-2 font-serif text-4xl">Account</h1>

      <div className="mt-8 rounded-lg border border-border bg-surface p-6 md:p-8">
        <dl className="space-y-4 text-sm">
          <div className="grid grid-cols-[7rem_1fr] gap-4">
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Email</dt>
            <dd className="text-foreground">{email || "—"}</dd>
          </div>
          <div className="grid grid-cols-[7rem_1fr] gap-4 border-t border-border pt-4">
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Joined</dt>
            <dd className="text-foreground">
              {joined ? new Date(joined).toLocaleDateString() : "—"}
            </dd>
          </div>
        </dl>
        <div className="mt-8 flex justify-end">
          <button
            onClick={signOut}
            className="rounded-md border border-border bg-surface px-4 py-2 text-sm text-foreground hover:bg-accent"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
