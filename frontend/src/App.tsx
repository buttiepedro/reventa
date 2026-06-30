import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider } from "@/context/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Layout } from "@/components/Layout/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Login } from "@/pages/Login";
import { NotFound } from "@/pages/NotFound";
import { Home } from "@/pages/home/Home";
import { Lonja } from "@/pages/lonja/Lonja";
import { Mercado } from "@/pages/mercado/Mercado";
import { Tasador } from "@/pages/tasador/Tasador";
import { MyAgency } from "@/pages/agency/MyAgency";
import { Companies } from "@/pages/admin/Companies";
import { CompanyDetail } from "@/pages/admin/CompanyDetail";
import { MyStock } from "@/pages/vehicles/MyStock";
import { VehicleForm } from "@/pages/vehicles/VehicleForm";
import { VehicleDetail } from "@/pages/vehicles/VehicleDetail";
import { PublicShare } from "@/pages/vehicles/PublicShare";
import { Favorites } from "@/pages/favorites/Favorites";
import { ChangePassword } from "@/pages/profile/ChangePassword";
import { SheetSync } from "@/pages/vehicles/SheetSync";
import { Catalog } from "@/pages/admin/Catalog";

const COMPANY_ROLES = ["company_admin", "company_user"] as const;
const ALL_ROLES = ["super_admin", ...COMPANY_ROLES] as const;

function Protected({ roles, children }: { roles: readonly string[]; children: React.ReactNode }) {
  return (
    <ProtectedRoute allowedRoles={[...roles]}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary>
          <Toaster position="top-center" richColors closeButton />
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/share/:token" element={<PublicShare />} />

            {/* Super admin */}
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute allowedRoles={["super_admin"]}>
                  <Layout>
                    <Routes>
                      <Route path="companies" element={<Companies />} />
                      <Route path="companies/:id" element={<CompanyDetail />} />
                      <Route path="catalog" element={<Catalog />} />
                      <Route path="*" element={<Navigate to="companies" replace />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Company roles — bottom nav tabs */}
            <Route path="/inicio" element={<Protected roles={COMPANY_ROLES}><Home /></Protected>} />
            <Route path="/lonja" element={<Protected roles={COMPANY_ROLES}><Lonja /></Protected>} />
            <Route path="/mercado" element={<Protected roles={COMPANY_ROLES}><Mercado /></Protected>} />
            <Route path="/tasador" element={<Protected roles={COMPANY_ROLES}><Tasador /></Protected>} />
            <Route path="/agencia" element={<Protected roles={COMPANY_ROLES}><MyAgency /></Protected>} />

            {/* Company stock management */}
            <Route path="/vehicles/my" element={<Protected roles={COMPANY_ROLES}><MyStock /></Protected>} />
            <Route path="/vehicles/new" element={<Protected roles={COMPANY_ROLES}><VehicleForm /></Protected>} />
            <Route path="/vehicles/sheet-sync" element={<Protected roles={COMPANY_ROLES}><SheetSync /></Protected>} />
            <Route path="/vehicles/:id" element={<Protected roles={COMPANY_ROLES}><VehicleDetail /></Protected>} />
            <Route path="/vehicles/:id/edit" element={<Protected roles={COMPANY_ROLES}><VehicleForm /></Protected>} />

            {/* Legacy redirects */}
            <Route path="/vehicles" element={<Navigate to="/mercado" replace />} />
            <Route path="/vehicles/pre-toma" element={<Navigate to="/mercado" replace />} />
            <Route path="/favorites" element={<Navigate to="/agencia" replace />} />

            {/* All authenticated */}
            <Route path="/profile/password" element={<Protected roles={ALL_ROLES}><ChangePassword /></Protected>} />

            <Route path="/" element={<Navigate to="/inicio" replace />} />
            <Route path="*" element={<Layout><NotFound /></Layout>} />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
