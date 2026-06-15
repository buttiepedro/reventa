import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import { AuthProvider } from "@/context/AuthContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Layout } from "@/components/Layout/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Login } from "@/pages/Login";
import { NotFound } from "@/pages/NotFound";
import { Companies } from "@/pages/admin/Companies";
import { CompanyDetail } from "@/pages/admin/CompanyDetail";
import { NetworkCatalog } from "@/pages/vehicles/NetworkCatalog";
import { MyStock } from "@/pages/vehicles/MyStock";
import { VehicleForm } from "@/pages/vehicles/VehicleForm";
import { VehicleDetail } from "@/pages/vehicles/VehicleDetail";
import { PublicShare } from "@/pages/vehicles/PublicShare";
import { Favorites } from "@/pages/favorites/Favorites";
import { ChangePassword } from "@/pages/profile/ChangePassword";
import { SheetSync } from "@/pages/vehicles/SheetSync";

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
          <Toaster position="top-right" richColors closeButton />
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
                      <Route path="*" element={<Navigate to="companies" replace />} />
                    </Routes>
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Company roles */}
            <Route path="/vehicles" element={<Protected roles={COMPANY_ROLES}><NetworkCatalog /></Protected>} />
            <Route path="/vehicles/my" element={<Protected roles={COMPANY_ROLES}><MyStock /></Protected>} />
            <Route path="/vehicles/new" element={<Protected roles={COMPANY_ROLES}><VehicleForm /></Protected>} />
            <Route path="/vehicles/sheet-sync" element={<Protected roles={COMPANY_ROLES}><SheetSync /></Protected>} />
            <Route path="/vehicles/:id" element={<Protected roles={COMPANY_ROLES}><VehicleDetail /></Protected>} />
            <Route path="/vehicles/:id/edit" element={<Protected roles={COMPANY_ROLES}><VehicleForm /></Protected>} />
            <Route path="/favorites" element={<Protected roles={COMPANY_ROLES}><Favorites /></Protected>} />

            {/* All authenticated users */}
            <Route path="/profile/password" element={<Protected roles={ALL_ROLES}><ChangePassword /></Protected>} />

            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Layout><NotFound /></Layout>} />
          </Routes>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
