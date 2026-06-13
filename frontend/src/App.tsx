import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

import { AuthProvider } from "@/context/AuthContext";
import { Layout } from "@/components/Layout/Layout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Login } from "@/pages/Login";
import { Companies } from "@/pages/admin/Companies";
import { CompanyDetail } from "@/pages/admin/CompanyDetail";
import { NetworkCatalog } from "@/pages/vehicles/NetworkCatalog";
import { MyStock } from "@/pages/vehicles/MyStock";
import { VehicleForm } from "@/pages/vehicles/VehicleForm";
import { VehicleDetail } from "@/pages/vehicles/VehicleDetail";
import { PublicShare } from "@/pages/vehicles/PublicShare";
import { Favorites } from "@/pages/favorites/Favorites";

const COMPANY_ROLES = ["company_admin", "company_user"] as const;

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />

          {/* Public share link — no auth required */}
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
          <Route
            path="/vehicles"
            element={
              <ProtectedRoute allowedRoles={[...COMPANY_ROLES]}>
                <Layout><NetworkCatalog /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/vehicles/my"
            element={
              <ProtectedRoute allowedRoles={[...COMPANY_ROLES]}>
                <Layout><MyStock /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/vehicles/new"
            element={
              <ProtectedRoute allowedRoles={[...COMPANY_ROLES]}>
                <Layout><VehicleForm /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/vehicles/:id"
            element={
              <ProtectedRoute allowedRoles={[...COMPANY_ROLES]}>
                <Layout><VehicleDetail /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/vehicles/:id/edit"
            element={
              <ProtectedRoute allowedRoles={[...COMPANY_ROLES]}>
                <Layout><VehicleForm /></Layout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/favorites"
            element={
              <ProtectedRoute allowedRoles={[...COMPANY_ROLES]}>
                <Layout><Favorites /></Layout>
              </ProtectedRoute>
            }
          />

          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
