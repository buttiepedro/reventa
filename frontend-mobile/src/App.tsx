import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { isLoggedIn } from "./auth";
import { LoginMobile } from "./pages/LoginMobile";
import { DashboardMobile } from "./pages/DashboardMobile";
import { ExpressUploadPage } from "./pages/ExpressUploadPage";
import { ExpressDetailPage } from "./pages/ExpressDetailPage";

function RequireAuth({ children }: { children: React.ReactNode }) {
  return isLoggedIn() ? <>{children}</> : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginMobile />} />
        <Route path="/" element={<RequireAuth><DashboardMobile /></RequireAuth>} />
        <Route path="/express/new" element={<RequireAuth><ExpressUploadPage /></RequireAuth>} />
        <Route path="/express/:id" element={<RequireAuth><ExpressDetailPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
