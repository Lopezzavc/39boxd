"use client";

import { useState, useTransition } from "react";
import { login } from "@/lib/actions/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await login(formData);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="mx-auto mt-24 max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">Iniciar sesión</h1>
      <form action={handleSubmit} className="space-y-3">
        <Input name="email" type="email" placeholder="Email" required />
        <Input name="password" type="password" placeholder="Contraseña" required />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <Button type="submit" disabled={isPending} className="w-full">
          {isPending ? "Entrando..." : "Entrar"}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        ¿No tienes cuenta?{" "}
        <a href="/auth/signup" className="underline">
          Crear cuenta
        </a>
      </p>
    </div>
  );
}