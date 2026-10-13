"use client";

import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { ErrorApi } from "@/lib/api";
import { claves } from "@/lib/consultas";

// Prepara TanStack Query para toda la página
export function Proveedores({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const cliente: QueryClient = new QueryClient({
      queryCache: new QueryCache({
        // Si la API responde 401 en cualquier consulta, la sesión venció: se marca que nadie entró
        // y ZonaPrivada manda al login.
        onError: (error) => {
          if (error instanceof ErrorApi && error.status === 401) {
            cliente.setQueryData(claves.sesion, null);
          }
        },
      }),
      defaultOptions: {
        queries: {
          // Reintenta solo los errores de conexión o del servidor: un 403 o un 404 no se arreglan solos
          retry: (intentos, error) => intentos < 2 && !(error instanceof ErrorApi && error.status >= 400 && error.status < 500),
        },
      },
    });
    return cliente;
  });

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
