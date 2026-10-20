// El "cartero" es lo que envía los correos. Igual que el avisador del tiempo real (tiempoReal.ts),
// la app lo recibe desde afuera, así cada lugar usa el que le sirve:
// - en la demo publicada, carteroDeBrevo, que los envía de verdad con la API de Brevo
// - en local (sin clave de Brevo), carteroDeConsola, que solo los anota en la consola
// - en los tests, uno falso que guarda lo que le pidieron enviar

export type Correo = {
  para: { email: string; nombre: string };
  asunto: string;
  html: string;
  texto: string;
  adjuntos?: { nombre: string; contenido: string }[];
};

export type Cartero = {
  enviar(correo: Correo): Promise<void>;
};

// Cuántos correos puede recibir una misma dirección en un día (ver conLimiteDiario)
export const MAXIMO_CORREOS_AL_DIA = 10;

// El cartero que no hace nada: el que usa la app si no se le pasa otro (por ejemplo, en los tests de antes)
export const sinCorreos: Cartero = {
  async enviar() {},
};

export function carteroDeConsola(): Cartero {
  return {
    async enviar({ para, asunto }) {
      console.log(`[correo] Para ${para.email}: ${asunto} (no se envió: falta BREVO_API_KEY)`);
    },
  };
}

// Envía con la API de Brevo (https://developers.brevo.com/reference/sendtransacemail).
// El plan gratis permite 300 correos al día. "fetch" se puede cambiar en los tests para no enviar nada de verdad.
export function carteroDeBrevo({
  apiKey,
  remitente,
  fetch = globalThis.fetch,
}: {
  apiKey: string;
  remitente: { email: string; nombre: string };
  fetch?: typeof globalThis.fetch;
}): Cartero {
  return {
    async enviar({ para, asunto, html, texto, adjuntos = [] }) {
      const respuesta = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          sender: { email: remitente.email, name: remitente.nombre },
          to: [{ email: para.email, name: para.nombre }],
          subject: asunto,
          htmlContent: html,
          textContent: texto,
          // Brevo pide los adjuntos en base64
          ...(adjuntos.length > 0 && {
            attachment: adjuntos.map(({ nombre, contenido }) => ({
              name: nombre,
              content: Buffer.from(contenido).toString("base64"),
            })),
          }),
        }),
      });

      if (!respuesta.ok) {
        throw new Error(`Brevo respondió ${respuesta.status}: ${await respuesta.text()}`);
      }
    },
  };
}

// Deja pasar como mucho "maximo" correos al día para cada destinatario. Así nadie puede usar la demo
// para llenarle la bandeja a otra persona (registrándose con su correo y reservando y cancelando muchas veces).
// La cuenta vive en la memoria del proceso: si la API se reinicia, empieza de cero.
export function conLimiteDiario(cartero: Cartero, maximo: number, ahora = () => new Date()): Cartero {
  const enviados = new Map<string, { dia: string; cantidad: number }>();

  return {
    async enviar(correo) {
      const dia = ahora().toISOString().slice(0, 10);
      const destinatario = correo.para.email.toLowerCase();
      const registro = enviados.get(destinatario);
      const cantidad = registro?.dia === dia ? registro.cantidad : 0;

      if (cantidad >= maximo) {
        console.warn(`[correo] No se envió a ${destinatario}: ya recibió ${maximo} correos hoy`);
        return;
      }

      enviados.set(destinatario, { dia, cantidad: cantidad + 1 });
      await cartero.enviar(correo);
    },
  };
}
