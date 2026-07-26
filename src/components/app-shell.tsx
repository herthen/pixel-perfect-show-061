import { Link, useRouterState } from "@tanstack/react-router";
import { LayoutDashboard, GraduationCap, BookText, LineChart, Settings2, UserRound } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/study", label: "Study", icon: GraduationCap },
  { to: "/vocabulary", label: "Vocabulary", icon: BookText },
  { to: "/progress", label: "Progress", icon: LineChart },
  { to: "/settings", label: "Settings", icon: Settings2 },
  { to: "/account", label: "Account", icon: UserRound },
] as const;

function Brand() {
  return (
    <div className="flex items-center gap-3 px-4 py-5">
      <span className="ink-mark" aria-hidden />
      <div className="leading-tight">
        <div className="font-serif text-[15px] text-foreground">Inkstone</div>
        <div className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">Chinese</div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen w-full bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl">
        {/* Desktop sidebar */}
        <aside className="hidden w-56 shrink-0 border-r border-border bg-sidebar md:flex md:flex-col">
          <Brand />
          <nav className="mt-2 flex flex-col gap-0.5 px-2">
            {NAV.map((item) => {
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-sidebar-accent text-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground",
                  )}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-4 w-[3px] -translate-y-1/2 rounded-r bg-cinnabar"
                    />
                  )}
                  <Icon className="h-4 w-4 opacity-80" strokeWidth={1.6} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-auto px-4 py-4 text-[11px] text-muted-foreground/80">
            v1 · Study a little, every day.
          </div>
        </aside>

        <div className="flex min-h-screen w-full flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="flex items-center justify-between border-b border-border bg-sidebar px-4 py-3 md:hidden">
            <div className="flex items-center gap-2">
              <span className="ink-mark" aria-hidden />
              <span className="font-serif text-sm">Inkstone Chinese</span>
            </div>
          </header>

          <main className="flex-1 px-4 pb-24 pt-6 md:px-10 md:pb-10 md:pt-10">{children}</main>

          {/* Mobile bottom nav */}
          <nav className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-around border-t border-border bg-sidebar/95 px-1 py-1.5 backdrop-blur md:hidden">
            {NAV.slice(0, 5).map((item) => {
              const active = pathname === item.to || pathname.startsWith(item.to + "/");
              const Icon = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={cn(
                    "flex min-w-14 flex-col items-center gap-0.5 rounded-md px-2 py-1.5 text-[10px]",
                    active ? "text-cinnabar" : "text-muted-foreground",
                  )}
                >
                  <Icon className="h-5 w-5" strokeWidth={1.6} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </div>
  );
}
