import type { ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { BottomNav } from "./BottomNav";
import { Header } from "./Header";

export function Layout({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const isCompanyUser = user?.role === "company_admin" || user?.role === "company_user";

  if (isCompanyUser) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header />
        <main className="pb-20 px-4 pt-4 max-w-2xl mx-auto">{children}</main>
        <BottomNav />
      </div>
    );
  }

  // Super admin keeps the classic layout
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
    </div>
  );
}
