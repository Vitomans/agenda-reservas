// Error que devuelve la API: trae el código (401, 409...) y un mensaje listo para mostrar.
export class ErrorApi extends Error {
  readonly status: number;
  // Errores por campo de un formulario, por ejemplo { email: ["El email no es válido"] }
  readonly detalles: Record<string, string[]>;

  constructor(status: number, mensaje: string, detalles: Record<string, string[]> = {}) {
    super(mensaje);
    this.status = status;
    this.detalles = detalles;
  }
}

type Opciones = {
  metodo?: "GET" | "POST" | "PATCH" | "DELETE";
  cuerpo?: unknown;
};

// Hace un pedido a la API y devuelve la respuesta ya convertida desde JSON.
// La ruta va sin "/api": pedirApi("/recursos") llama a /api/recursos.
// La cookie de sesión viaja sola, porque la API está en el mismo sitio que la página (ver next.config.ts).
export async function pedirApi<T>(ruta: string, { metodo = "GET", cuerpo }: Opciones = {}): Promise<T> {
  let respuesta: Response;

  try {
    respuesta = await fetch(`/api${ruta}`, {
      method: metodo,
      headers: cuerpo === undefined ? undefined : { "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
  } catch {
    throw new ErrorApi(0, "No se pudo conectar con el servidor. Revisa tu conexión e intenta de nuevo.");
  }

  // 204 significa "listo, sin nada que devolver" (por ejemplo, al cancelar una reserva)
  const datos = respuesta.status === 204 ? null : await respuesta.json().catch(() => null);

  if (!respuesta.ok) {
    throw new ErrorApi(respuesta.status, datos?.error ?? "Algo salió mal. Intenta de nuevo.", datos?.detalles);
  }

  return datos as T;
}
