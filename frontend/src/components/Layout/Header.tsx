import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { useAuth } from "@/hooks/useAuth";
import { useAudience } from "@/context/AudienceContext";
import { PinModal } from "@/components/PinModal";
import { notificationService, type AppNotification } from "../../services/notificationService";

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { isClientMode, enterClientMode, exitClientMode, setPin } = useAudience();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [showPinModal, setShowPinModal] = useState<"enter" | "set" | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const notifRef = useRef<HTMLDivElement>(null);

  const isCompanyUser = user?.role === "company_admin" || user?.role === "company_user";
  const isSuperAdmin = user?.role === "super_admin";

  useEffect(() => {
    if (!isCompanyUser) return;
    const fetchCount = () =>
      notificationService.count().then((r) => setUnread(r.unread)).catch(() => {});
    fetchCount();
    const id = setInterval(fetchCount, 30_000);
    return () => clearInterval(id);
  }, [isCompanyUser]);

  const openNotifications = async () => {
    if (notifOpen) { setNotifOpen(false); return; }
    const list = await notificationService.list().catch(() => []);
    setNotifications(list);
    setNotifOpen(true);
  };

  const handleMarkAllRead = async () => {
    await notificationService.readAll().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnread(0);
  };

  const handleNotifClick = async (n: AppNotification) => {
    if (!n.is_read) {
      await notificationService.markRead(n.id).catch(() => {});
      setNotifications((prev) => prev.map((x) => x.id === n.id ? { ...x, is_read: true } : x));
      setUnread((u) => Math.max(0, u - 1));
    }
    setNotifOpen(false);
    if (n.entity_type === "pre_toma" || n.entity_type === "pre_toma_interest") {
      navigate("/mercado");
    } else if (n.entity_type === "favorite_request" || n.entity_type === "favorite_accepted") {
      navigate("/agencia");
    } else if (n.entity_type === "direct_match") {
      navigate("/inicio");
    }
  };

  const handleLogout = () => { logout(); navigate("/login"); };

  const setMode = (client: boolean) => {
    if (client === isClientMode) return;
    if (client) setShowPinModal("enter");
    else exitClientMode();
  };

  const adminNavClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors pb-0.5 border-b-2 ${
      isActive ? "text-brand border-brand" : "text-muted border-transparent hover:text-ink"
    }`;

  const timeAgo = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return "ahora";
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    return `hace ${Math.floor(diff / 86400)} d`;
  };

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-white/92 backdrop-blur-md">
      <div className="mx-auto flex h-[58px] max-w-2xl items-center gap-3 px-4 lg:h-[62px] lg:max-w-none lg:px-6">
        {/* Logo — hidden on desktop for company users (the rail carries the brand) */}
        <Link
          to={isCompanyUser ? "/inicio" : "/admin/companies"}
          className={`shrink-0 text-lg font-extrabold tracking-tight text-brand ${isCompanyUser ? "lg:hidden" : ""}`}
        >
          Stockar
        </Link>

        {/* Super admin nav */}
        {isSuperAdmin && (
          <nav className="flex items-center gap-6">
            <NavLink to="/admin/companies" className={adminNavClass}>Empresas</NavLink>
            <NavLink to="/admin/catalog" className={adminNavClass}>Catálogo</NavLink>
          </nav>
        )}

        {/* Desktop global search (company users) */}
        {isCompanyUser && (
          <button
            onClick={() => navigate("/mercado")}
            className="hidden h-[38px] max-w-[460px] flex-1 items-center gap-2.5 rounded-[10px] border border-line bg-fill px-3 text-left transition-colors hover:border-gray-300 lg:flex"
          >
            <SearchIcon className="h-[15px] w-[15px] text-faint" />
            <span className="text-[13.5px] text-faint">Buscar marca, modelo, dominio…</span>
            <kbd className="ml-auto rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10px] font-semibold text-faint">
              ⌘K
            </kbd>
          </button>
        )}

        {/* Session mode segmented toggle (company users) */}
        {isCompanyUser && (
          <div
            role="tablist"
            aria-label="Modo de sesión"
            className="ml-auto flex items-center rounded-[9px] bg-tab p-[3px]"
          >
            <SessionSegment
              label="Sin Cliente"
              active={!isClientMode}
              onClick={() => setMode(false)}
            />
            <SessionSegment
              label="Con Cliente"
              active={isClientMode}
              tone="warn"
              onClick={() => setMode(true)}
            />
          </div>
        )}

        {/* Right side */}
        {user && (
          <div className={`flex items-center gap-1.5 ${isCompanyUser ? "" : "ml-auto"}`}>
            {/* Notification bell (company users only) */}
            {isCompanyUser && (
              <div className="relative" ref={notifRef}>
                <button
                  onClick={openNotifications}
                  aria-label="Notificaciones"
                  className="relative flex h-9 w-9 items-center justify-center rounded-[10px] border border-line text-muted transition-colors hover:bg-canvas"
                >
                  <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unread > 0 && (
                    <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-[1.5px] border-white bg-red-500" />
                  )}
                </button>

                {notifOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                    <div className="dropdown-panel absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-2xl border border-line bg-surface shadow-lg">
                      <div className="flex items-center justify-between border-b border-line-soft px-4 py-2.5">
                        <span className="text-sm font-semibold text-ink">Notificaciones</span>
                        {notifications.some((n) => !n.is_read) && (
                          <button onClick={handleMarkAllRead} className="text-xs text-brand hover:underline">
                            Marcar todas como leídas
                          </button>
                        )}
                      </div>
                      <div className="max-h-80 divide-y divide-line-soft overflow-y-auto">
                        {notifications.length === 0 ? (
                          <p className="py-6 text-center text-sm text-faint">Sin notificaciones</p>
                        ) : (
                          notifications.map((n) => (
                            <button
                              key={n.id}
                              onClick={() => handleNotifClick(n)}
                              className={`w-full px-4 py-3 text-left transition-colors hover:bg-canvas ${!n.is_read ? "bg-mint" : ""}`}
                            >
                              <div className="flex items-start gap-2">
                                {!n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-lo" />}
                                <div className={!n.is_read ? "" : "ml-4"}>
                                  <p className="text-xs font-medium leading-snug text-ink">{n.title}</p>
                                  <p className="mt-0.5 font-mono text-[11px] text-faint">{timeAgo(n.created_at)}</p>
                                </div>
                              </div>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* User menu */}
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                aria-label="Cuenta"
                className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-line text-muted transition-colors hover:bg-canvas"
              >
                <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </button>

              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                  <div className="dropdown-panel absolute right-0 z-20 mt-2 w-44 rounded-2xl border border-line bg-surface py-1 shadow-lg">
                    <div className="border-b border-line-soft px-4 py-2">
                      <p className="truncate text-xs font-semibold text-ink">{user.full_name}</p>
                      <p className="text-xs text-faint">{user.role.replace(/_/g, " ")}</p>
                    </div>
                    <Link
                      to="/profile/password"
                      onClick={() => setMenuOpen(false)}
                      className="block px-4 py-2 text-sm text-ink-soft hover:bg-canvas"
                    >
                      Cambiar contraseña
                    </Link>
                    {isCompanyUser && (
                      <button
                        onClick={() => { setMenuOpen(false); setShowPinModal("set"); }}
                        className="w-full px-4 py-2 text-left text-sm text-ink-soft hover:bg-canvas"
                      >
                        Configurar PIN cliente
                      </button>
                    )}
                    <hr className="my-1 border-line-soft" />
                    <button
                      onClick={handleLogout}
                      className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                    >
                      Cerrar sesión
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* PIN modal: enter client mode */}
      {showPinModal === "enter" && (
        <PinModal
          title="Modo Con Cliente"
          subtitle="Ingresá tu PIN para activar la vista de cliente"
          onSubmit={async (pin) => {
            const ok = await enterClientMode(pin);
            if (!ok) toast.error("PIN incorrecto");
            else setShowPinModal(null);
            return ok;
          }}
          onCancel={() => setShowPinModal(null)}
        />
      )}

      {/* PIN modal: set / change PIN */}
      {showPinModal === "set" && (
        <PinModal
          title="Configurar PIN de cliente"
          subtitle="Elegí un PIN de 4–8 dígitos para proteger el modo concesionaria"
          onSubmit={async (pin) => {
            try {
              await setPin(pin);
              toast.success("PIN guardado");
              setShowPinModal(null);
              return true;
            } catch {
              toast.error("PIN inválido (4–8 dígitos)");
              return false;
            }
          }}
          onCancel={() => setShowPinModal(null)}
        />
      )}
    </header>
  );
}

function SessionSegment({
  label,
  active,
  tone = "brand",
  onClick,
}: {
  label: string;
  active: boolean;
  tone?: "brand" | "warn";
  onClick: () => void;
}) {
  const dot = active ? (tone === "warn" ? "bg-amber-600" : "bg-brand") : "border-[1.5px] border-faint";
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex h-[30px] items-center gap-2 rounded-[7px] px-3 text-[12.5px] transition-all ${
        active ? "bg-surface font-semibold text-ink shadow-sm" : "font-medium text-muted"
      }`}
    >
      <span className={`h-[7px] w-[7px] rounded-full ${dot}`} />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="m20 20-3.2-3.2" />
    </svg>
  );
}
