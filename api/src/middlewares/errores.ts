import type { ErrorRequestHandler, RequestHandler } from "express";
import { z } from "zod";

// Error con un código HTTP y un mensaje que sí se le puede mostrar al cliente.
// Las rutas lo lanzan (por ejemplo, new ErrorHttp(409, "...")) y manejarErrores lo responde.
export class ErrorHttp extends Error {
  readonly status: number;

  constructor(status: number, mensaje: string) {
    super(mensaje);
    this.status = status;
  }
}

// Responde 404 cuando ninguna ruta coincide con el pedido.
export const rutaNoEncontrada: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
};

// Último middleware: atrapa los errores lanzados en las rutas y los convierte en respuestas JSON.
export const manejarErrores: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ErrorHttp) {
    res.status(error.status).json({ error: error.message });
    return;
  }

  // Zod no aceptó los datos: se dice qué campo está mal y por qué
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: "Datos inválidos", detalles: z.flattenError(error).fieldErrors });
    return;
  }

  // express.json() no pudo leer el cuerpo del pedido
  if (error?.type === "entity.parse.failed") {
    res.status(400).json({ error: "El cuerpo del pedido no es un JSON válido" });
    return;
  }

  // Cualquier otro error es un problema nuestro: el detalle queda en el log del servidor
  // y al cliente nunca se le muestran datos internos.
  console.error(error);
  res.status(500).json({ error: "Error interno del servidor" });
};
