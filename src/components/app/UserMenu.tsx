"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function initials(name: string) {
  return name
    .split(/[\s,]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function UserMenu({ name, caption }: { name: string; caption: string }) {
  const router = useRouter();
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex items-center gap-2.5 rounded-full py-1 pl-1 pr-2.5 text-left transition-colors hover:bg-white/5 data-popup-open:bg-white/5">
        <span className="grid size-8 place-items-center rounded-full bg-gold text-xs font-semibold text-night">{initials(name)}</span>
        <span className="hidden min-w-0 max-w-44 lg:block">
          <span className="block truncate text-[13px] font-medium leading-tight text-ivory">{name}</span>
          <span className="block truncate text-[11px] leading-tight text-ivory/50">{caption}</span>
        </span>
        <ChevronDown className="size-4 text-ivory/50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={10} className="w-60">
        <DropdownMenuGroup>
          <DropdownMenuLabel className="py-2">
            <span className="block text-sm font-medium text-foreground">{name}</span>
            <span className="block text-xs text-muted-foreground">{caption}</span>
          </DropdownMenuLabel>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={leaving} onClick={logout}>
          <LogOut /> Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
