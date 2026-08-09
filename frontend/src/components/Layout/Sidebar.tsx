import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";

import { companyService } from "@/services/companyService";
import { notificationService } from "@/services/notificationService";
import { useAudience } from "@/context/AudienceContext";
import type { CompanyProfile } from "@/types";
import { navItems, railSecondary } from "./navItems";

/** Fixed 232px desktop rail — same five sections as the mobile bottom nav. */
export function Sidebar() {
  const { isClientMode } = useAudience();
  const [profile, setProfile] = useState<CompanyProfile | null>(null);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    companyService.getMyProfile().then(setProfile).catch(() => {});
    const fetchCount = () =>
      notificationService.count().then((r) => setUnread(r.unread)).catch(() => {});
    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => clearInterval(id);
  }, []);

  const counts: Record<string, number> = { "/inicio": unread };
  const visible = isClientMode ? navItems.filter((t) => t.to === "/mercado") : navItems;

  const itemClass = (active: boolean) =>
    `flex items-center gap-3 h-[38px] px-2.5 rounded-[9px] transition-colors ${
      active ? "bg-mint text-brand font-semibold" : "text-muted font-medium hover:bg-canvas"
    }`;

  return (
    <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] flex-col border-r border-line bg-surface px-3.5 py-5 lg:flex">
      {/* Brand */}
      <Link to="/inicio" className="flex items-center gap-2.5 px-2 pb-5">
        <span className="h-[26px] w-[26px] rounded-lg bg-brand" />
        <span className="text-base font-bold tracking-tight text-ink">Reventa</span>
      </Link>

      {/* Primary nav */}
      <nav className="flex flex-col gap-0.5">
        {visible.map((t) => (
          <NavLink key={t.to} to={t.to} className={({ isActive }) => itemClass(isActive)}>
            {({ isActive }) => (
              <>
                {t.icon("h-[15px] w-[15px] shrink-0")}
                <span className="text-[13.5px]">{t.label}</span>
                {counts[t.to] > 0 && (
                  <span
                    className={`ml-auto font-mono text-[11px] font-bold ${isActive ? "text-brand" : "text-faint"}`}
                  >
                    {counts[t.to]}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {!isClientMode && (
        <>
          <div className="mx-2 my-4 h-px bg-line-soft" />

          {/* Secondary actions */}
          <nav className="flex flex-col gap-0.5">
            {railSecondary.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 h-[34px] px-2.5 rounded-[9px] text-[13px] font-medium transition-colors ${
                    isActive ? "bg-mint text-brand" : "text-faint hover:bg-canvas"
                  }`
                }
              >
                {t.icon("h-[15px] w-[15px] shrink-0")}
                <span>{t.label}</span>
              </NavLink>
            ))}
          </nav>
        </>
      )}

      {/* Agency card */}
      <Link
        to="/agencia"
        className="mt-auto flex items-center gap-2.5 rounded-[11px] border border-line px-3 py-2.5 transition-colors hover:bg-canvas"
      >
        {profile?.logo_url ? (
          <img src={profile.logo_url} alt="" className="h-8 w-8 shrink-0 rounded-[9px] object-cover" />
        ) : (
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-line text-[15px] font-light text-ink">
            {(profile?.name ?? "R")[0]}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-semibold text-ink">
            {profile?.name ?? "Mi Agencia"}
          </span>
          {profile?.cuit_verified ? (
            <span className="mt-0.5 flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-lo" />
              <span className="text-[11px] font-medium text-brand">Verificada</span>
            </span>
          ) : (
            <span className="mt-0.5 block text-[11px] text-faint">Sin verificar</span>
          )}
        </span>
      </Link>
    </aside>
  );
}
