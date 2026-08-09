import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isCompanyUser = user?.role === "company_admin" || user?.role === "company_user";

  if (isCompanyUser) {
    return (
      <div className="min-h-screen bg-canvas">
        <Sidebar />
        <div className="lg:pl-[232px]">
          <Header />
          <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4 lg:max-w-5xl lg:px-8 lg:pb-12 lg:pt-6">
            {children}
          </main>
        </div>
        <BottomNav />
      </div>
    );
  }

  // Super admin keeps the classic layout
  return (
    <div className="min-h-screen bg-canvas">
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
