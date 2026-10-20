import { createHash, timingSafeEqual } from "node:crypto";
import type { Request, RequestHandler } from "express";
import { ErrorHttp } from "./errores.ts";

// La API publicada solo atiende los pedidos que llegan por la página (el puente de web/proxy.ts).
// El puente les agrega dos cabeceras: una clave que solo conocen la página y la API, y la IP del visitante.
//
// Sin esto, cualquiera podría llamar a la API directo, sin pasar por la página, e inventar una IP
// distinta en cada pedido para saltarse el límite de intentos del login.

export const CABECERA_CLAVE = "x-clave-de-la-web";
export const CABECERA_IP = "x-ip-del-visitante";

// Le agrega a "req" la IP que mandó la página, para que TypeScript la conozca
declare module "express-serve-static-core" {
  interface Request {
    ipDelVisitante?: string;
  }
}

// Compara las claves sin dar pistas por el tiempo que tarda. Una comparación normal se detiene en el
// primer carácter distinto, y midiendo cuánto tarda, alguien podría adivinar la clave de a poco.
// timingSafeEqual necesita dos textos del mismo largo, por eso se compara el resumen (hash) de cada una.
function sonIguales(a: string, b: string) {
  const resumen = (texto: string) => createHash("sha256").update(texto).digest();
  return timingSafeEqual(resumen(a), resumen(b));
}

// Si no hay clave (en local y en los tests), atiende a todos y se usa la IP de la conexión.
// Va después de /api/salud, así el despertador que visita la API cada 5 minutos no necesita la clave.
export function soloDesdeLaWeb(clave: string | undefined): RequestHandler {
  return (req, _res, next) => {
    if (!clave) {
      next();
      return;
    }

    const recibida = req.get(CABECERA_CLAVE);
    if (!recibida || !sonIguales(recibida, clave)) {
      throw new ErrorHttp(403, "Esta API solo atiende los pedidos que llegan desde la página de Volea");
    }

    // La cabecera de la IP solo se cree si vino con la clave: el puente la pone y borra la que mande el visitante
    req.ipDelVisitante = req.get(CABECERA_IP) || undefined;
    next();
  };
}

// La IP con la que se cuentan los intentos del login: la que mandó la página, o si no, la de la conexión
export function ipDelVisitante(req: Request) {
  return req.ipDelVisitante ?? req.ip ?? "";
}
