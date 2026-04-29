"use client";

import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOutClient } from "@/lib/client-auth";
import { SyncStatusBadge } from "@/components/layout/SyncStatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";

type HeaderProps = {
  userName: string;
  userEmail: string;
};

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/salespeople": "Salespeople",
  "/escalations": "Escalations",
  "/recovery-plan": "Recovery Plan",
  "/sync": "Sync",
  "/settings": "Settings",
};

function getTitle(pathname: string) {
  return pageTitles[pathname] ?? "Synergy Recovery OS";
}

export function Header({ userName, userEmail }: HeaderProps) {
  const pathname = usePathname();
  const initials = userName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-6">
      <h1 className="text-lg font-semibold text-slate-900">{getTitle(pathname)}</h1>
      <div className="flex items-center gap-3">
        <SyncStatusBadge />
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="outline" size="sm" className="gap-2" />}>
            <Avatar size="sm">
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
            <span className="hidden sm:inline">{userName}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="bottom" align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium text-slate-900">{userName}</p>
              <p className="text-xs text-slate-500">{userEmail}</p>
            </div>
            <DropdownMenuItem onClick={() => void signOutClient("/login")}>
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
