import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    passed += 1;
    console.log(`PASS - ${label}`);
  } else {
    failed += 1;
    console.error(`FAIL - ${label}`);
  }
}

const migration = read("supabase/migrations/20260905004500_affiliate_self_service_links.sql");
const client = read("src/lib/affiliates.ts");
const wrapper = read("src/components/account/AffiliateSelfServicePanel.tsx");
const page = read("src/components/account/AffiliateAccountPage.tsx");

check(
  "cliente possui RPC propria para ativar afiliado",
  migration.includes("CREATE OR REPLACE FUNCTION public.activate_my_affiliate()") &&
    migration.includes("auth.uid()") &&
    migration.includes("public.generate_affiliate_referral_code()") &&
    client.includes('callSupabaseRpc<unknown>("activate_my_affiliate")'),
);

check(
  "reativacao preserva o mesmo codigo",
  migration.includes("ELSIF affiliate_row.status <> 'active' THEN") &&
    !/ELSIF affiliate_row\.status <> 'active'[\s\S]*referral_code\s*=/.test(migration),
);

check(
  "cliente pode desativar o proprio link sem apagar historico",
  migration.includes("CREATE OR REPLACE FUNCTION public.deactivate_my_affiliate()") &&
    migration.includes("status = 'disabled'") &&
    migration.includes("deactivated_at = COALESCE(deactivated_at, now())") &&
    !migration.includes("DELETE FROM public.affiliate_commissions") &&
    client.includes('callSupabaseRpc<unknown>("deactivate_my_affiliate")'),
);

check(
  "exclusao da conta invalida link e preserva registro historico",
  migration.includes("ON DELETE SET NULL") &&
    migration.includes("disable_affiliate_before_user_delete") &&
    migration.includes("BEFORE DELETE ON auth.users") &&
    migration.includes("status = 'disabled'"),
);

check(
  "somente usuario autenticado executa ativacao e desativacao",
  migration.includes("REVOKE ALL ON FUNCTION public.activate_my_affiliate() FROM PUBLIC, anon") &&
    migration.includes("REVOKE ALL ON FUNCTION public.deactivate_my_affiliate() FROM PUBLIC, anon") &&
    migration.includes("GRANT EXECUTE ON FUNCTION public.activate_my_affiliate() TO authenticated") &&
    migration.includes("GRANT EXECUTE ON FUNCTION public.deactivate_my_affiliate() TO authenticated"),
);

check(
  "painel mostra convite de ativacao em vez de estado vazio tecnico",
  wrapper.includes("Ganhe indicando novos clientes") &&
    wrapper.includes("Quero ser afiliado") &&
    page.includes("<AffiliateSelfServicePanel />"),
);

check(
  "afiliado controla desativacao e reativacao do proprio link",
  wrapper.includes("Desativar meu link") &&
    wrapper.includes("Reativar meu link") &&
    wrapper.includes('runLifecycle("deactivate")'),
);

check(
  "area do cliente nao usa icone de porcentagem",
  !page.includes("BadgePercent") && page.includes("icon: Link2"),
);

console.log(`\n${passed}/${passed + failed} validações aprovadas.`);
if (failed > 0) process.exit(1);
