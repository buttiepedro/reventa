import { useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";

export function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const isCompanyUser = user?.role === "company_admin" || user?.role === "company_user";
  const isSuperAdmin = user?.role === "super_admin";

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `text-sm font-medium transition-colors pb-0.5 border-b-2 ${
      isActive
        ? "text-blue-600 border-blue-600"
        : "text-gray-600 border-transparent hover:text-gray-900"
    }`;

  return (
    <header className="sticky top-0 z-40 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="text-lg font-black text-blue-700 tracking-tight shrink-0">
            Reventa
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-6">
            {isCompanyUser && (
              <>
                <NavLink to="/vehicles" end className={navLinkClass}>Red</NavLink>
                <NavLink to="/vehicles/my" className={navLinkClass}>Mi stock</NavLink>
                <NavLink to="/favorites" className={navLinkClass}>Favoritas</NavLink>
              </>
            )}
            {isSuperAdmin && (
              <NavLink to="/admin/companies" className={navLinkClass}>Empresas</NavLink>
            )}
          </nav>

          {/* Right side */}
          {user && (
            <div className="flex items-center gap-3">
              {/* User dropdown */}
              <div className="relative hidden md:block">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 focus:outline-none"
                >
                  <span className="font-medium">{user.full_name}</span>
                  <span className="text-gray-400 text-xs">({user.role.replace(/_/g, " ")})</span>
                  <svg className="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 mt-2 w-44 bg-white rounded-lg shadow-lg border border-gray-100 z-20 py-1">
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

              {/* Mobile hamburger */}
              <button
                className="md:hidden p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                onClick={() => setMobileNavOpen(!mobileNavOpen)}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {mobileNavOpen
                    ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Mobile nav panel */}
      {mobileNavOpen && user && (
        <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 flex flex-col gap-3">
          {isCompanyUser && (
            <>
              <NavLink to="/vehicles" end className={navLinkClass} onClick={() => setMobileNavOpen(false)}>Red</NavLink>
              <NavLink to="/vehicles/my" className={navLinkClass} onClick={() => setMobileNavOpen(false)}>Mi stock</NavLink>
              <NavLink to="/favorites" className={navLinkClass} onClick={() => setMobileNavOpen(false)}>Favoritas</NavLink>
            </>
          )}
          {isSuperAdmin && (
            <NavLink to="/admin/companies" className={navLinkClass} onClick={() => setMobileNavOpen(false)}>Empresas</NavLink>
          )}
          <hr className="border-gray-100" />
          <Link to="/profile/password" className="text-sm text-gray-700" onClick={() => setMobileNavOpen(false)}>
            Cambiar contraseña
          </Link>
          <button onClick={handleLogout} className="text-sm text-red-600 text-left">Cerrar sesión</button>
        </div>
      )}
    </header>
  );
}
