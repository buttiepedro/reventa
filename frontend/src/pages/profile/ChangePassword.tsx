import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ApiError } from "@/types";

export function ChangePassword() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (next !== confirm) {
      toast.error("Las contraseñas nuevas no coinciden.");
      return;
    }
    if (next.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setSaving(true);
    try {
      await authService.changePassword(current, next);
      toast.success("Contraseña actualizada correctamente.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      toast.error((err as ApiError).detail ?? "Error al cambiar la contraseña.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto pt-6 pb-16">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Cambiar contraseña</h1>
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Contraseña actual"
            type="password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
            autoComplete="current-password"
          />
          <Input
            label="Nueva contraseña"
            type="password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Input
            label="Confirmar nueva contraseña"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Button type="submit" loading={saving} className="mt-2">
            Cambiar contraseña
          </Button>
        </form>
      </div>
    </div>
  );
}
