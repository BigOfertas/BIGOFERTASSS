import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const migration = read("supabase/migrations/20260902041000_phase_10_order_integrity_hardening.sql");

const checks = [];
const check = (name, condition) => checks.push([name, Boolean(condition)]);

check(
  "pedidos reais exigem chave de idempotencia",
  /ALTER TABLE public\.orders[\s\S]*ALTER COLUMN idempotency_key SET NOT NULL/.test(migration),
);

check(
  "referencia de pagamento nao pode pertencer a dois pedidos",
  /CREATE UNIQUE INDEX IF NOT EXISTS orders_payment_provider_reference_unique/.test(migration) &&
    /lower\(payment_provider\), payment_reference/.test(migration),
);

const lockPosition = migration.indexOf("FOR UPDATE;");
const eventLookupPosition = migration.indexOf("FROM public.notification_events AS event_record");

check(
  "retry concorrente consulta evento somente depois do lock do pedido",
  lockPosition >= 0 && eventLookupPosition >= 0 && lockPosition < eventLookupPosition,
);

check(
  "evento idempotente nao pode ser reaproveitado em outro pedido",
  /existing_event_order_id IS DISTINCT FROM p_order_id/.test(migration) &&
    /Evento de pagamento ja associado a outro pedido/.test(migration),
);

check(
  "retry idempotente precisa coincidir com pagamento ja registrado",
  /target_order\.paid_at IS NULL/.test(migration) &&
    /target_order\.payment_provider IS DISTINCT FROM normalized_provider/.test(migration) &&
    /target_order\.payment_reference IS DISTINCT FROM normalized_reference/.test(migration) &&
    /target_order\.paid_amount IS DISTINCT FROM p_paid_amount/.test(migration),
);

check(
  "confirmacao de pagamento continua restrita ao backend",
  /REVOKE ALL ON FUNCTION public\.record_order_payment[^;]*FROM PUBLIC/.test(migration) &&
    /GRANT EXECUTE ON FUNCTION public\.record_order_payment[^;]*TO service_role/.test(migration) &&
    !/GRANT EXECUTE ON FUNCTION public\.record_order_payment[^;]*TO authenticated/.test(migration),
);

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} - ${name}`);
  if (!ok) failed += 1;
}

if (failed) process.exit(1);
console.log(`\n${checks.length}/${checks.length} validacoes de hardening aprovadas.`);
