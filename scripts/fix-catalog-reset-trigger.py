from pathlib import Path

migration = Path("supabase/migrations/20260909152000_google_photos_catalog_import.sql")
value = migration.read_text()
old = '''    UPDATE public.products
    SET status = 'archived'::public.product_status,
        updated_at = now()
    WHERE status <> 'archived'::public.product_status;

    DELETE FROM public.products;'''
new = '''    UPDATE public.products
    SET status = 'archived'::public.product_status,
        updated_at = now()
    WHERE status <> 'archived'::public.product_status;

    -- Remove variantes explicitamente enquanto o produto pai ainda existe e ja esta
    -- arquivado. Assim block_last_active_variant_removal() enxerga o status nao-ativo
    -- do pai antes que a exclusao do produto torne a linha invisivel ao trigger.
    DELETE FROM public.product_variants;

    DELETE FROM public.products;'''
if old not in value:
    raise SystemExit("reset block not found")
migration.write_text(value.replace(old, new, 1))

deployer = Path("scripts/deploy-storefront-upgrade-migrations.mjs")
d = deployer.read_text()
old_name = '[\n    "google_photos_catalog_import",\n    "supabase/migrations/20260909152000_google_photos_catalog_import.sql",\n  ],'
new_name = '[\n    "google_photos_catalog_import_reset_fix_20260909",\n    "supabase/migrations/20260909152000_google_photos_catalog_import.sql",\n  ],'
if old_name not in d:
    raise SystemExit("deployer migration tuple not found")
deployer.write_text(d.replace(old_name, new_name, 1))

print("CATALOG_RESET_TRIGGER_FIX_PREPARED")
