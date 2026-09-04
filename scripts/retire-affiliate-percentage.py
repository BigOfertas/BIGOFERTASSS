from pathlib import Path
import re


def read(path: str) -> str:
    return Path(path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    Path(path).write_text(content, encoding="utf-8")


def replace_once(path: str, before: str, after: str) -> None:
    source = read(path)
    if before not in source:
        raise RuntimeError(f"Expected block not found in {path}: {before[:120]!r}")
    write(path, source.replace(before, after, 1))


migration = """BEGIN;

-- A regra percentual foi aposentada. As colunas antigas continuam apenas para
-- preservar snapshots historicos; novas configuracoes usam exclusivamente
-- comissao fixa por peca e suas faixas.

UPDATE public.affiliate_program_settings
SET commission_rate_bps = NULL,
    commission_base_mode = NULL,
    updated_at = now()
WHERE singleton = true;

REVOKE ALL ON FUNCTION public.owner_save_affiliate_program_draft(integer, text, integer, numeric, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_configure_affiliate_program(boolean, integer, text, integer, numeric, text)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.owner_save_affiliate_program_draft(integer, text, integer, numeric, text) IS
  'LEGADO: configuracao percentual aposentada. O programa vigente usa faixas de valor fixo por peca.';
COMMENT ON FUNCTION public.owner_configure_affiliate_program(boolean, integer, text, integer, numeric, text) IS
  'LEGADO: configuracao percentual aposentada. O programa vigente usa faixas de valor fixo por peca.';

COMMIT;
"""
write("supabase/migrations/20260904052500_affiliate_percentage_path_retirement.sql", migration)

# Remove toda a interface e estado morto de configuracao percentual.
path = "src/components/admin/AffiliateAdmin.tsx"
source = read(path)
for token in ["  BadgePercent,\n", "  Save,\n", "  ShieldCheck,\n"]:
    source = source.replace(token, "")
source = source.replace(
    'import { useEffect, useMemo, useState } from "react";',
    'import { useState } from "react";',
)
for token in [
    "  configureAffiliateProgram,\n",
    "  saveAffiliateProgramDraft,\n",
    "  type AffiliateProgramDraft,\n",
]:
    source = source.replace(token, "")

patterns = [
    (r"\nfunction formatPercent\([\s\S]*?\n}\n\nfunction formatBase\([\s\S]*?\n}\n", "\n", "format helpers"),
    (r"\n  const \[commissionPercent, setCommissionPercent\][\s\S]*?\n  const \[rulesInitialized, setRulesInitialized\] = useState\(false\);", "", "legacy states"),
    (r"\n  useEffect\(\(\) => \{[\s\S]*?\n  const actionMutation = useMutation\(\{", "\n\n  const actionMutation = useMutation({", "legacy editor"),
    (r"\n  function completedDraft\(\) \{[\s\S]*?\n  }\n\n  const overview = overviewQuery\.data;", "\n\n  const overview = overviewQuery.data;", "completedDraft"),
]
for pattern, replacement, label in patterns:
    source, count = re.subn(pattern, replacement, source, count=1)
    if count != 1:
        raise RuntimeError(f"Could not remove {label}")

marker = """function withdrawalStatusLabel(value: string | null | undefined) {
  if (value === \"requested\") return \"Solicitado\";
  if (value === \"paid\") return \"Pago\";
  if (value === \"rejected\") return \"Não aprovado\";
  return value || \"—\";
}
"""
if marker not in source:
    raise RuntimeError("Withdrawal status helper marker not found")
source = source.replace(
    marker,
    marker
    + """
function refundReviewStatusLabel(value: string | null | undefined) {
  if (value === \"pending\") return \"Pendente\";
  if (value === \"resolved\") return \"Revisado\";
  return value || \"—\";
}
""",
    1,
)
source = source.replace("{row.review_status}</p>", "{refundReviewStatusLabel(row.review_status)}</p>")
source = source.replace(
    '{overview.holdDays === null ? "A definir" : `${overview.holdDays} dias`}',
    '{overview.holdDays === null ? "A definir" : overview.holdDays === 0 ? "Imediata" : `${overview.holdDays} dias`}',
)
write(path, source)

# Remove clientes RPC antigos do frontend para que nao exista um caminho alternativo.
path = "src/lib/admin-affiliates.ts"
source = read(path)
source = source.replace("  commissionRateBps: number | null;\n", "")
source = source.replace('  commissionBaseMode: "items_after_discount" | "order_total" | null;\n', "")
source, count = re.subn(r"\nexport type AffiliateProgramDraft = \{[\s\S]*?\n};\n", "\n", source, count=1)
if count != 1:
    raise RuntimeError("AffiliateProgramDraft not found")
source, count = re.subn(r"  const base =\n[\s\S]*?\n      : null;\n\n", "", source, count=1)
if count != 1:
    raise RuntimeError("Legacy overview base normalization not found")
source = source.replace("    commissionRateBps: nullableNumber(row.commissionRateBps),\n", "")
source = source.replace("    commissionBaseMode: base,\n", "")
source, count = re.subn(
    r"\nexport function saveAffiliateProgramDraft\([\s\S]*?\n}\n\nexport function configureAffiliateProgram\([\s\S]*?\n}\n",
    "\n",
    source,
    count=1,
)
if count != 1:
    raise RuntimeError("Legacy affiliate admin RPC clients not found")
write(path, source)

# Instala a nova migration no deploy e adiciona verificacoes reais no banco.
path = "scripts/deploy-affiliate-backend.mjs"
source = read(path)
old = """if (!appliedNames.has(\"affiliate_pix_withdrawal_and_defaults\")) {
  await applyMigration(
    \"affiliate_pix_withdrawal_and_defaults\",
    \"supabase/migrations/20260904052000_affiliate_pix_withdrawal_and_defaults.sql\",
  );
  appliedNames.add(\"affiliate_pix_withdrawal_and_defaults\");
}

const verification = await readOnly(`"""
new = """if (!appliedNames.has(\"affiliate_pix_withdrawal_and_defaults\")) {
  await applyMigration(
    \"affiliate_pix_withdrawal_and_defaults\",
    \"supabase/migrations/20260904052000_affiliate_pix_withdrawal_and_defaults.sql\",
  );
  appliedNames.add(\"affiliate_pix_withdrawal_and_defaults\");
}

if (!appliedNames.has(\"affiliate_percentage_path_retirement\")) {
  await applyMigration(
    \"affiliate_percentage_path_retirement\",
    \"supabase/migrations/20260904052500_affiliate_percentage_path_retirement.sql\",
  );
  appliedNames.add(\"affiliate_percentage_path_retirement\");
}

const verification = await readOnly(`"""
if old not in source:
    raise RuntimeError("0520 deploy marker not found")
source = source.replace(old, new, 1)

old = """  ) as confirmed_business_defaults,
  not exists (
    select 1
    from public.affiliate_program_settings s
    where s.singleton = true
      and s.enabled
      and (s.hold_days is null or s.minimum_withdrawal is null or s.withdrawal_method is null)
  ) as enabled_configuration_safe;"""
new = """  ) as confirmed_business_defaults,
  not has_function_privilege(
    'authenticated',
    'public.owner_save_affiliate_program_draft(integer,text,integer,numeric,text)',
    'EXECUTE'
  ) as legacy_draft_rpc_retired,
  not has_function_privilege(
    'authenticated',
    'public.owner_configure_affiliate_program(boolean,integer,text,integer,numeric,text)',
    'EXECUTE'
  ) as legacy_configure_rpc_retired,
  not exists (
    select 1 from public.affiliate_program_settings s
    where s.singleton = true
      and (s.commission_rate_bps is not null or s.commission_base_mode is not null)
  ) as legacy_percentage_settings_cleared,
  (select amount_per_unit = 20 from public.resolve_affiliate_commission_tier('00000000-0000-0000-0000-000000000000'::uuid, 1)) as tier_1_safe,
  (select amount_per_unit = 20 from public.resolve_affiliate_commission_tier('00000000-0000-0000-0000-000000000000'::uuid, 7)) as tier_7_safe,
  (select amount_per_unit = 18 from public.resolve_affiliate_commission_tier('00000000-0000-0000-0000-000000000000'::uuid, 8)) as tier_8_safe,
  (select amount_per_unit = 15 from public.resolve_affiliate_commission_tier('00000000-0000-0000-0000-000000000000'::uuid, 15)) as tier_15_safe,
  (select amount_per_unit = 15 from public.resolve_affiliate_commission_tier('00000000-0000-0000-0000-000000000000'::uuid, 34)) as tier_34_safe,
  (select amount_per_unit = 12 from public.resolve_affiliate_commission_tier('00000000-0000-0000-0000-000000000000'::uuid, 35)) as tier_35_safe,
  not exists (
    select 1
    from public.affiliate_program_settings s
    where s.singleton = true
      and s.enabled
      and (s.hold_days is null or s.minimum_withdrawal is null or s.withdrawal_method is null)
  ) as enabled_configuration_safe;"""
if old not in source:
    raise RuntimeError("verification business defaults marker not found")
source = source.replace(old, new, 1)

old = """  \"confirmed_business_defaults\",
  \"withdrawal_method_column\","""
new = """  \"confirmed_business_defaults\",
  \"legacy_draft_rpc_retired\",
  \"legacy_configure_rpc_retired\",
  \"legacy_percentage_settings_cleared\",
  \"tier_1_safe\",
  \"tier_7_safe\",
  \"tier_8_safe\",
  \"tier_15_safe\",
  \"tier_34_safe\",
  \"tier_35_safe\",
  \"withdrawal_method_column\","""
if old not in source:
    raise RuntimeError("required verification marker not found")
source = source.replace(old, new, 1)
write(path, source)

# Atualiza validacao local para detectar qualquer regressao para percentual.
path = "scripts/validate-affiliate-backend.mjs"
source = read(path)
old = """const finalRules = read(
  \"supabase/migrations/20260904052000_affiliate_pix_withdrawal_and_defaults.sql\",
);
const commissionEditor = read(\"src/components/admin/AffiliateCommissionSettings.tsx\");"""
new = """const finalRules = read(
  \"supabase/migrations/20260904052000_affiliate_pix_withdrawal_and_defaults.sql\",
);
const percentageRetirement = read(
  \"supabase/migrations/20260904052500_affiliate_percentage_path_retirement.sql\",
);
const adminAffiliates = read(\"src/lib/admin-affiliates.ts\");
const commissionEditor = read(\"src/components/admin/AffiliateCommissionSettings.tsx\");"""
if old not in source:
    raise RuntimeError("Validation input marker not found")
source = source.replace(old, new, 1)

old = """check(
  \"painel administrativo mostra todas as faixas fixas ao mesmo tempo\","""
new = """check(
  \"caminho percentual antigo foi aposentado no frontend e no banco\",
  percentageRetirement.includes(\"REVOKE ALL ON FUNCTION public.owner_save_affiliate_program_draft\") &&
    percentageRetirement.includes(\"REVOKE ALL ON FUNCTION public.owner_configure_affiliate_program\") &&
    !adminPanel.includes(\"commissionPercent\") &&
    !adminPanel.includes(\"commissionBaseMode\") &&
    !adminAffiliates.includes(\"saveAffiliateProgramDraft\") &&
    !adminAffiliates.includes(\"configureAffiliateProgram\"),
);

check(
  \"painel administrativo mostra todas as faixas fixas ao mesmo tempo\","""
if old not in source:
    raise RuntimeError("Validation fixed tier marker not found")
source = source.replace(old, new, 1)
write(path, source)

print("Affiliate percentage path retired in working tree.")
