import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { authOptions } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect("/login");
  }

  const userName = session.user.name ?? "Admin";
  const userEmail = session.user.email ?? "";

  return (
    <div className="flex h-screen bg-slate-100">
      <div className="hidden md:block">
        <Sidebar userName={userName} userEmail={userEmail} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col bg-white">
        <div className="border-b border-slate-200 px-4 py-3 md:hidden">
          <MobileNav userName={userName} userEmail={userEmail} />
        </div>
        <Header userName={userName} userEmail={userEmail} />
        <main className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
