"use client";

import { Menu } from "lucide-react";
import { Sidebar } from "@/components/layout/Sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

type MobileNavProps = {
  userName: string;
  userEmail: string;
};

export function MobileNav({ userName, userEmail }: MobileNavProps) {
  return (
    <Sheet>
      <SheetTrigger render={<Button variant="outline" size="icon-sm" className="md:hidden" />}>
        <Menu className="h-4 w-4" />
        <span className="sr-only">Open navigation</span>
      </SheetTrigger>
      <SheetContent side="left" className="w-[260px] p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>Navigation</SheetTitle>
        </SheetHeader>
        <Sidebar userName={userName} userEmail={userEmail} />
      </SheetContent>
    </Sheet>
  );
}
