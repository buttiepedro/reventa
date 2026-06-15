import { Link } from "react-router-dom";

export function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center">
        <p className="text-6xl font-bold text-blue-600 mb-4">404</p>
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Página no encontrada</h1>
        <p className="text-gray-500 mb-8">La URL que ingresaste no existe o fue movida.</p>
        <Link
          to="/"
          className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
