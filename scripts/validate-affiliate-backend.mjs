import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const core = read(
  "supabase/migrations/20260904041000_affiliate_referral_backend.sql",
);
const hardening = read(
  "supabase/migrations/20260904042500_affiliate_backend_hardening.sql",
);
const admin = read(
  "supabase/migrations/20260904044000_affiliate_admin_queries.sql",
);
const processor = read("supabase/functions/notifications-process/index.ts");

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`PASS - ${label}`);
    return;
  }
  failed += 1;
  console.error(`FAIL - ${label}`);
}

check(
  "modelo de afiliado nasce de indicacao de conta, nao de produto",
  core.includes("affiliate_referral_code") &&
    core.includes("affiliate_referrals") &&
    !core.includes("affiliate_product") &&
    !core.includes("affiliate_click"),
);

check(
  "vinculo do indicado e unico e imutavel por conta",
  /CREATE TABLE public\.affiliate_referrals[\s\S]*referred_user_id uuid PRIMARY KEY/.test(
    core,
  ) && core.includes("ON CONFLICT (referred_user_id) DO NOTHING"),
);

check(
  "cadastro captura codigo somente no nascimento da conta",
  /CREATE OR REPLACE FUNCTION public\.handle_new_user\(\)[\s\S]*NEW\.raw_user_meta_data ->> 'affiliate_referral_code'[\s\S]*INSERT INTO public\.affiliate_referrals/.test(
    core,
  ),
);

check(
  "codigo invalido nao impede cadastro normal",
  core.includes("IF matched_affiliate_id IS NOT NULL THEN") &&
    !core.includes("RAISE EXCEPTION 'Codigo de afiliado"),
);

check(
  "programa inicia desligado e exige regras comerciais explicitas",
  core.includes("enabled boolean NOT NULL DEFAULT false") &&
    core.includes("affiliate_program_enabled_requires_rules") &&
    core.includes("commission_rate_bps IS NOT NULL") &&
    core.includes("commission_base_mode IS NOT NULL") &&
    core.includes("hold_days IS NOT NULL") &&
    core.includes("minimum_withdrawal IS NOT NULL"),
);

check(
  "comissao guarda snapshot financeiro e uma unica linha por pedido",
  /order_id uuid NOT NULL UNIQUE REFERENCES public\.orders/.test(core) &&
    core.includes("commission_base_amount") &&
    core.includes("commission_rate_bps") &&
    core.includes("commission_amount"),
);

check(
  "pedido pago de cliente indicado aciona criacao de comissao",
  core.includes("capture_affiliate_commission_after_payment") &&
    core.includes("AFTER UPDATE OF payment_status ON public.orders") &&
    core.includes("create_affiliate_commission_for_paid_order(NEW.id)"),
);

check(
  "falha do modulo de afiliados nao desfaz pagamento confirmado",
  /capture_affiliate_commission_after_payment[\s\S]*EXCEPTION WHEN OTHERS[\s\S]*RAISE WARNING/.test(
    core,
  ),
);

check(
  "reembolso cancela automaticamente somente comissao ainda pendente",
  core.includes("cancel_pending_affiliate_commission_after_refund") &&
    core.includes("WHERE order_id = NEW.id AND status = 'pending'"),
);

check(
  "liberacao respeita prazo e ignora pedido reembolsado",
  core.includes("c.available_at <= now()") &&
    core.includes("o.status = 'refunded'::public.order_status"),
);

check(
  "liberacao global e restrita ao service role",
  hardening.includes("FROM authenticated") &&
    hardening.includes("TO service_role") &&
    hardening.includes("release_due_affiliate_commissions(uuid)"),
);

check(
  "saldo para saque desconta saques solicitados e ja pagos",
  core.includes("status IN ('requested','paid')") &&
    core.includes("greatest(available_total - reserved_total, 0)"),
);

check(
  "saque respeita minimo configurado e nao inventa meio de pagamento",
  core.includes("p_amount < settings_row.minimum_withdrawal") &&
    core.includes("destination_snapshot jsonb") &&
    !core.includes("pix_key") &&
    !core.includes("bank_account"),
);

check(
  "RLS protege tabelas do programa",
  [
    "affiliate_program_settings",
    "affiliates",
    "affiliate_referrals",
    "affiliate_commissions",
    "affiliate_withdrawals",
  ].every((table) =>
    core.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`),
  ),
);

check(
  "cliente usa RPCs proprios e escrita direta permanece revogada",
  core.includes("get_my_affiliate_dashboard") &&
    core.includes("list_my_affiliate_referrals") &&
    core.includes("request_my_affiliate_withdrawal") &&
    core.includes("REVOKE ALL ON TABLE public.affiliate_commissions FROM PUBLIC, anon, authenticated"),
);

check(
  "owner tem resumo operacional sem calculo financeiro no frontend",
  admin.includes("owner_get_affiliate_overview") &&
    admin.includes("unreservedAvailableAmount") &&
    admin.includes("requestedWithdrawalsCount"),
);

check(
  "owner pode listar afiliados, comissoes e fila de saques",
  admin.includes("owner_list_affiliates") &&
    admin.includes("owner_list_affiliate_commissions") &&
    admin.includes("owner_list_affiliate_withdrawals"),
);

check(
  "RPCs administrativas verificam papel owner",
  (admin.match(/public\.has_role\('owner'::public\.app_role\)/g) ?? []).length >= 4,
);

check(
  "processador gera link de cadastro a partir do codigo de indicacao",
  processor.includes('optionalPayloadText(event, "affiliate_link")') &&
    processor.includes('payloadText(event, "referral_code")') &&
    processor.includes('new URL("/cadastro"') &&
    processor.includes('url.searchParams.set("ref", referralCode)'),
);

check(
  "emails de afiliado apontam para a secao correta da conta",
  processor.includes("/conta?secao=afiliados"),
);

check(
  "cron de emails tambem libera comissoes vencidas sem quebrar antes da migration",
  processor.includes("releaseDueAffiliateCommissions") &&
    processor.includes('payload?.code === "PGRST202"') &&
    processor.indexOf("await releaseDueAffiliateCommissions()") <
      processor.indexOf("const events = await claimEvents(20)"),
);

console.log(`\n${passed}/${passed + failed} validacoes aprovadas.`);
if (failed > 0) process.exit(1);
