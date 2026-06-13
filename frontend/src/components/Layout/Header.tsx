import { Link, NavLink } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";

export function Header() {
  const { user, logout } = useAuth();

  const isCompanyUser = user?.role === "company_admin" || user?.role === "company_user";

  return (
    <header
      style={{
        padding: "0.75rem 2rem",
        borderBottom: "1px solid #e5e7eb",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        background: "#fff",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
        <Link to="/" style={{ fontWeight: 800, textDecoration: "none", fontSize: "1.15rem", color: "#1e3a8a" }}>
          Reventa
        </Link>

        {isCompanyUser && (
          <nav style={{ display: "flex", gap: "1.25rem", fontSize: "0.9rem" }}>
            <NavLink
              to="/vehicles"
              end
              style={({ isActive }) => navStyle(isActive)}
            >
              Red
            </NavLink>
            <NavLink
              to="/vehicles/my"
              style={({ isActive }) => navStyle(isActive)}
            >
              Mi stock
            </NavLink>
            <NavLink
              to="/favorites"
              style={({ isActive }) => navStyle(isActive)}
            >
              Favoritas
            </NavLink>
          </nav>
        )}
      </div>

      {user && (
        <div style={{ display: "flex", gap: "1rem", alignItems: "center", fontSize: "0.875rem" }}>
          <span style={{ color: "#6b7280" }}>
            {user.full_name}{" "}
            <span style={{ color: "#9ca3af" }}>({user.role.replace(/_/g, " ")})</span>
          </span>
          <button onClick={logout} style={{ cursor: "pointer", padding: "5px 12px", border: "1px solid #d1d5db", borderRadius: 6, background: "#f9fafb", fontSize: "0.875rem" }}>
            Salir
          </button>
        </div>
      )}
    </header>
  );
}

function navStyle(isActive: boolean): React.CSSProperties {
  return {
    textDecoration: "none",
    color: isActive ? "#1d4ed8" : "#374151",
    fontWeight: isActive ? 600 : 400,
    borderBottom: isActive ? "2px solid #1d4ed8" : "2px solid transparent",
    paddingBottom: "2px",
  };
}
