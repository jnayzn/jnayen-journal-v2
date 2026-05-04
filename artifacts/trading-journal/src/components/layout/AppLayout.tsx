import {
  BarChart3,
  CalendarDays,
  Cable,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Settings as SettingsIcon,
  TerminalSquare,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/trades", label: "Trades", icon: ListChecks },
  { href: "/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/bridge", label: "MT5 Bridge", icon: Cable },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
] as const;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-border bg-card md:flex">
        <div className="flex items-center gap-2 px-6 py-5">
          <TerminalSquare className="h-5 w-5 text-primary" />
          <span className="text-sm font-semibold tracking-tight">jnayen.tradej</span>
        </div>
        <Separator />
        <nav className="flex-1 space-y-1 px-2 py-4">
          {navItems.map((item) => {
            const active =
              item.href === "/"
                ? location === "/"
                : location.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <a
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </a>
              </Link>
            );
          })}
        </nav>
        <Separator />
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
              {(user?.username ?? "?").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 truncate text-xs">
              <div className="truncate font-medium">{user?.username ?? "—"}</div>
              <div className="truncate text-muted-foreground">authenticated</div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-7xl p-6">{children}</div>
      </main>
    </div>
  );
}
