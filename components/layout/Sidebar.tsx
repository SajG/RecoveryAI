"use client";

import Link from "next/link";
import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import { AlertTriangle, Calendar, LayoutDashboard, MessageCircle, RefreshCw, Settings, Users } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type SidebarProps = {
  userName: string;
  userEmail: string;
};

const items = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Salespeople", href: "/salespeople", icon: Users },
  { label: "WhatsApp Digest", href: "/whatsapp-digest", icon: MessageCircle },
  { label: "Escalations", href: "/escalations", icon: AlertTriangle },
  { label: "Recovery Plan", href: "/recovery-plan", icon: Calendar },
  { label: "Sync", href: "/sync", icon: RefreshCw },
];

export function Sidebar({ userName, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside className="flex h-full w-[260px] flex-col bg-slate-900 text-slate-100">
      <div className="border-b border-slate-800 px-6 py-5">
        <p className="text-base font-semibold tracking-tight">Synergy Recovery OS</p>
        <p className="text-xs text-slate-400">Powered by AI</p>
      </div>

      <nav className="flex-1 px-3 py-4">
        <ul className="space-y-1">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                    isActive
                      ? "bg-[rgb(var(--primary))] text-white"
                      : "text-slate-300 hover:bg-slate-800 hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {item.href === "/escalations" ? <span className="ml-auto h-2 w-2 rounded-full bg-red-500" /> : null}
                  {item.href === "/sync" ? <span className="ml-auto h-2 w-2 rounded-full bg-emerald-500" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-slate-800 px-3 pb-3">
        <Link
          href="/settings"
          className={cn(
            "mt-3 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
            pathname === "/settings"
              ? "bg-[rgb(var(--primary))] text-white"
              : "text-slate-300 hover:bg-slate-800 hover:text-white"
          )}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Link>
      </div>

      <div className="border-t border-slate-800 px-4 py-4">
        <div className="mb-3 flex items-center gap-3">
          <Avatar size="sm">
            <AvatarFallback className="bg-slate-700 text-slate-100">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{userName}</p>
            <p className="truncate text-xs text-slate-400">{userEmail}</p>
          </div>
        </div>
        <Button
          variant="outline"
          className="w-full border-slate-700 bg-transparent text-slate-100 hover:bg-slate-800 hover:text-slate-100"
          onClick={() => signOut({ callbackUrl: "/login" })}
        >
          Sign out
        </Button>
      </div>
    </aside>
  );
}
