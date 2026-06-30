import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { notificationService, type AppNotification } from "../../services/notificationService";

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
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

  const adminNavClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors pb-0.5 border-b-2 ${
      isActive ? "text-green-600 border-green-600" : "text-gray-600 border-transparent hover:text-gray-900"
    }`;

  const timeAgo = (dateStr: string) => {
    const diff = (Date.now() - new Date(dateStr).getTime()) / 1000;
    if (diff < 60) return "ahora";
    if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
    return `hace ${Math.floor(diff / 86400)} d`;
  };

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-2xl mx-auto px-4">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to={isCompanyUser ? "/inicio" : "/admin/companies"} className="text-lg font-black text-green-600 tracking-tight shrink-0">
            Reventa
          </Link>

          {/* Super admin nav */}
          {isSuperAdmin && (
            <nav className="flex items-center gap-6">
              <NavLink to="/admin/companies" className={adminNavClass}>Empresas</NavLink>
              <NavLink to="/admin/catalog" className={adminNavClass}>Catálogo</NavLink>
            </nav>
          )}

          {/* Right side */}
          {user && (
            <div className="flex items-center gap-2">
              {/* Notification bell (company users only) */}
              {isCompanyUser && (
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={openNotifications}
                    className="relative p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                    </svg>
                    {unread > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-0.5">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </button>

                  {notifOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                      <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-20 overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
                          <span className="text-sm font-semibold text-gray-800">Notificaciones</span>
                          {notifications.some((n) => !n.is_read) && (
                            <button onClick={handleMarkAllRead} className="text-xs text-green-600 hover:underline">
                              Marcar todas como leídas
                            </button>
                          )}
                        </div>
                        <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                          {notifications.length === 0 ? (
                            <p className="text-sm text-gray-400 text-center py-6">Sin notificaciones</p>
                          ) : (
                            notifications.map((n) => (
                              <button
                                key={n.id}
                                onClick={() => handleNotifClick(n)}
                                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${!n.is_read ? "bg-green-50" : ""}`}
                              >
                                <div className="flex items-start gap-2">
                                  {!n.is_read && <span className="mt-1.5 w-2 h-2 rounded-full bg-green-500 shrink-0" />}
                                  <div className={!n.is_read ? "" : "ml-4"}>
                                    <p className="text-xs font-medium text-gray-800 leading-snug">{n.title}</p>
                                    <p className="text-xs text-gray-400 mt-0.5">{timeAgo(n.created_at)}</p>
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
                  className="flex items-center gap-1.5 p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-lg border border-gray-100 z-20 py-1">
                      <div className="px-4 py-2 border-b border-gray-50">
                        <p className="text-xs font-semibold text-gray-800 truncate">{user.full_name}</p>
                        <p className="text-xs text-gray-400">{user.role.replace(/_/g, " ")}</p>
                      </div>
                      <Link
                        to="/profile/password"
                        onClick={() => setMenuOpen(false)}
                        className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      >
                        Cambiar contraseña
                      </Link>
                      <hr className="my-1 border-gray-100" />
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
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
      </div>
    </header>
  );
}
