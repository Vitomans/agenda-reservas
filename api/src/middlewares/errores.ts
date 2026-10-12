import type { ErrorRequestHandler, RequestHandler } from "express";

// Responde 404 cuando ninguna ruta coincide con el pedido.
export const rutaNoEncontrada: RequestHandler = (_req, res) => {
  res.status(404).json({ error: "Ruta no encontrada" });
};

// Último middleware: atrapa cualquier error que nadie manejó antes.
// El detalle queda en el log del servidor; al cliente nunca se le muestran datos internos.
export const manejarErrores: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error);
  res.status(500).json({ error: "Error interno del servidor" });
};
