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
    -- arquivado. Isso permite que block_last_active_variant_removal() enxergue o
    -- status nao-ativo do pai. Deixar a FK CASCADE fazer isso somente durante o
    -- DELETE de products tornaria o pai invisivel para o trigger e causaria falso
    -- positivo de "Produto ativo precisa manter ao menos uma variante ativa".
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

validator = Path("scripts/validate-google-photos-final-pipeline.mjs")
v = validator.read_text()
needle = 'assert.match(importMigration, /catalog_apply_normalized_batch/);\n'
addition = '''assert.match(importMigration, /catalog_apply_normalized_batch/);\nconst variantResetIndex = importMigration.indexOf("DELETE FROM public.product_variants;");\nconst productResetIndex = importMigration.indexOf("DELETE FROM public.products;");\nassert.ok(variantResetIndex >= 0 && productResetIndex > variantResetIndex, "catalog reset must delete variants before products");\n'''
if needle not in v:
    raise SystemExit("validator insertion point not found")
validator.write_text(v.replace(needle, addition, 1))

print("CATALOG_RESET_TRIGGER_FIX_PREPARED")
