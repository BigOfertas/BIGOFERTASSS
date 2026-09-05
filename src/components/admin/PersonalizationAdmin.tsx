import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, LoaderCircle, Palette, Trash2 } from "lucide-react";
import { useState, type ChangeEvent } from "react";

import {
  SITE_ASSET_ACCEPT,
  SITE_ASSET_DEFINITIONS,
  clearAdminStorefrontAsset,
  fetchAdminStorefrontPersonalization,
  uploadAdminStorefrontAsset,
  type SiteAssetDefinition,
  type SiteAssetSlotKey,
} from "@/lib/site-personalization";
import { getUserFacingError } from "@/lib/user-facing-error";

const GROUPS: Array<{ id: SiteAssetDefinition["group"]; title: string; description: string }> = [
  { id: "top", title: "Carrossel acima do cabeçalho", description: "Arte promocional contínua. PC e mobile usam arquivos separados para não cortar texto importante." },
  { id: "hero", title: "Banner abaixo do cabeçalho", description: "Banner principal da campanha. É apenas visual e não possui ação ao clicar." },
  { id: "categories", title: "Monte seu pedido", description: "Uma arte vertical por card. Cada card já aponta para a categoria correta da loja." },
  { id: "ambient", title: "Faixa intermediária", description: "Arte entre Monte seu pedido e a área do Brasileirão." },
  { id: "brasileirao", title: "Banner Brasileirão", description: "Ao clicar, o cliente é levado para a seção de produtos do Brasileirão na própria página." },
];

function ratioText(width: number, height: number) {
  const ratio = width / height;
  return `${ratio.toFixed(ratio >= 10 ? 1 : 2)}:1`;
}

function formatBytes(value: number | null) {
  if (!value || value <= 0) return null;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

export function PersonalizationAdmin() {
  const queryClient = useQueryClient();
  const [busySlot, setBusySlot] = useState<SiteAssetSlotKey | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const query = useQuery({
    queryKey: ["admin-storefront-personalization"],
    queryFn: fetchAdminStorefrontPersonalization,
    staleTime: 10_000,
  });

  const mutation = useMutation({
    mutationFn: async (operation: () => Promise<unknown>) => operation(),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-storefront-personalization"] }),
        queryClient.invalidateQueries({ queryKey: ["storefront-personalization"] }),
      ]);
    },
  });

  async function run(slotKey: SiteAssetSlotKey, operation: () => Promise<unknown>, success: string) {
    if (busySlot) return;
    setBusySlot(slotKey);
    setMessage("");
    setError("");
    try {
      await mutation.mutateAsync(operation);
      setMessage(success);
    } catch (caught) {
      setError(getUserFacingError(caught, "Não foi possível atualizar esta imagem agora."));
    } finally {
      setBusySlot(null);
    }
  }

  async function handleFile(definition: SiteAssetDefinition, event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    await run(
      definition.key,
      () => uploadAdminStorefrontAsset({ slotKey: definition.key, file }),
      `${definition.label} — ${definition.device} atualizado com sucesso.`,
    );
  }

  if (query.isLoading) {
    return (
      <section className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center">
        <LoaderCircle className="mx-auto h-6 w-6 animate-spin text-red-600" />
        <p className="mt-3 text-sm font-semibold text-gray-500">Carregando personalização...</p>
      </section>
    );
  }

  if (query.error) {
    return (
      <section className="rounded-2xl border border-red-200 bg-red-50 px-6 py-8 text-sm font-semibold text-red-700">
        Não foi possível carregar as imagens de personalização.
      </section>
    );
  }

  const assets = query.data ?? {};

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-red-50 text-red-600">
            <Palette className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-black tracking-tight text-gray-950">Personalização</h1>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-gray-500">
              Troque as artes fixas da página inicial sem alterar código. Nos banners largos, PC e mobile possuem uploads separados para preservar o enquadramento.
            </p>
          </div>
        </div>
      </header>

      {message ? <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{message}</p> : null}
      {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}

      {GROUPS.map((group) => {
        const definitions = SITE_ASSET_DEFINITIONS.filter((definition) => definition.group === group.id);
        return (
          <section key={group.id} className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-black text-gray-950">{group.title}</h2>
            <p className="mt-1 text-sm leading-6 text-gray-500">{group.description}</p>

            <div className={`mt-5 grid gap-4 ${group.id === "categories" ? "sm:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-2"}`}>
              {definitions.map((definition) => {
                const asset = assets[definition.key];
                const busy = busySlot === definition.key;
                const expectedRatio = definition.width / definition.height;
                const actualRatio = asset?.widthPx && asset.heightPx ? asset.widthPx / asset.heightPx : null;
                const ratioWarning = actualRatio !== null && Math.abs(actualRatio - expectedRatio) / expectedRatio > 0.04;

                return (
                  <article key={definition.key} className="overflow-hidden rounded-xl border border-gray-200 bg-gray-50">
                    <div className={`${definition.group === "categories" ? "aspect-[2/3]" : "aspect-[16/6]"} flex items-center justify-center overflow-hidden bg-white`}>
                      {asset?.url ? (
                        <img src={asset.url} alt={`Prévia: ${definition.label} ${definition.device}`} className="h-full w-full object-contain" loading="lazy" />
                      ) : (
                        <div className="px-5 text-center text-sm font-semibold text-gray-400">Nenhuma imagem personalizada neste slot.</div>
                      )}
                    </div>

                    <div className="space-y-3 border-t border-gray-200 bg-white p-4">
                      <div>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="text-sm font-black text-gray-950">{definition.label}</h3>
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-gray-600">{definition.device}</span>
                        </div>
                        <p className="mt-2 text-xs leading-5 text-gray-600">
                          Ideal: <strong>{definition.width} × {definition.height} px</strong> · proporção aproximada <strong>{ratioText(definition.width, definition.height)}</strong>
                        </p>
                        <p className="mt-1 text-xs leading-5 text-gray-500">Formato: {definition.format}. JPEG também é aceito quando não houver transparência.</p>
                        <p className="mt-1 text-xs leading-5 text-gray-500">{definition.behavior}</p>
                      </div>

                      {asset ? (
                        <div className={`rounded-lg px-3 py-2 text-xs ${ratioWarning ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"}`}>
                          Arquivo atual: {asset.widthPx ?? "?"} × {asset.heightPx ?? "?"} px{formatBytes(asset.byteSize) ? ` · ${formatBytes(asset.byteSize)}` : ""}.
                          {ratioWarning ? " A proporção está diferente da recomendada e pode sofrer recorte." : " Proporção adequada ao slot."}
                        </div>
                      ) : null}

                      <div className="flex flex-wrap gap-2">
                        <label className={`inline-flex h-10 cursor-pointer items-center justify-center rounded-lg px-4 text-xs font-black ${busy ? "cursor-not-allowed bg-gray-200 text-gray-500" : "bg-red-600 text-white hover:bg-red-700"}`}>
                          {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <ImagePlus className="mr-2 h-4 w-4" />}
                          {asset ? "Trocar imagem" : "Anexar imagem"}
                          <input type="file" accept={SITE_ASSET_ACCEPT} disabled={Boolean(busySlot)} onChange={(event) => void handleFile(definition, event)} className="sr-only" />
                        </label>

                        {asset ? (
                          <button
                            type="button"
                            disabled={Boolean(busySlot)}
                            onClick={() => void run(definition.key, () => clearAdminStorefrontAsset(definition.key), "Imagem removida. O slot voltou ao padrão do site.")}
                            className="inline-flex h-10 items-center rounded-lg border border-gray-200 bg-white px-3 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Remover
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
