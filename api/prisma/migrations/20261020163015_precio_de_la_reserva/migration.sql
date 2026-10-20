-- Cada reserva guarda lo que costó (ver "precio" en schema.prisma).
-- Las reservas que ya existían no tenían precio, así que se calcula con las tarifas de
-- src/servicios/precios.ts: $16.000 en hora punta (de lunes a viernes desde las 18:00,
-- y todo el fin de semana) y $12.000 en el resto. Las horas se miran en la hora del club.

-- 1. Se agrega la columna, todavía sin obligar a que tenga valor
ALTER TABLE "Reserva" ADD COLUMN "precio" INTEGER;

-- 2. Se le pone precio a cada reserva. "inicio" está guardado en UTC: primero se le dice a
--    PostgreSQL que es UTC y después se pasa a la hora de Chile.
UPDATE "Reserva"
SET "precio" = CASE
  WHEN EXTRACT(ISODOW FROM ("inicio" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago') >= 6
    OR EXTRACT(HOUR FROM ("inicio" AT TIME ZONE 'UTC') AT TIME ZONE 'America/Santiago') >= 18
  THEN 16000
  ELSE 12000
END;

-- 3. Ahora sí, toda reserva tiene que tener precio
ALTER TABLE "Reserva" ALTER COLUMN "precio" SET NOT NULL;
