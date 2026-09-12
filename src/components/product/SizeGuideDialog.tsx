import { Info, Loader2, Ruler } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  fetchProductPurchaseConfig,
  type ProductCommercialType,
} from "@/lib/product-purchase";

type GuideKey = "torcedor" | "jogador" | "feminino" | "infantil" | "basquete";

type SizeGuide = {
  key: GuideKey;
  shortLabel: string;
  title: string;
  columns: string[];
  rows: string[][];
};

const SIZE_GUIDES: Record<GuideKey, SizeGuide> = {
  torcedor: {
    key: "torcedor",
    shortLabel: "Torcedor",
    title: "Camisa Fan - Torcedor",
    columns: ["Tam", "Compr.", "Largura", "Altura", "Peso"],
    rows: [
      ["P", "69-71", "53-55", "162-170", "50-62"],
      ["M", "71-73", "55-57", "170-176", "62-78"],
      ["G", "73-75", "57-58", "176-182", "78-83"],
      ["GG", "75-78", "58-60", "182-190", "83-90"],
      ["2XL", "78-81", "60-62", "190-195", "90-97"],
      ["3XL", "81-83", "62-64", "192-197", "97-104"],
      ["4XL", "83-85", "64-65", "197-200", "104-110"],
    ],
  },
  jogador: {
    key: "jogador",
    shortLabel: "Jogador",
    title: "Camisa Player - Jogador",
    columns: ["Tam", "Compr.", "Largura", "Altura", "Peso"],
    rows: [
      ["P", "67-69", "49-51", "162-170", "50-62"],
      ["M", "69-71", "51-53", "170-175", "62-78"],
      ["G", "71-73", "53-55", "175-180", "78-83"],
      ["GG", "73-76", "55-57", "180-185", "83-90"],
      ["2XL", "76-78", "57-60", "185-190", "90-97"],
      ["3XL", "78-79", "60-63", "190-195", "97-104"],
    ],
  },
  feminino: {
    key: "feminino",
    shortLabel: "Feminina",
    title: "Camisa Feminina",
    columns: ["Tam", "Compr.", "Largura", "Altura", "Peso"],
    rows: [
      ["P", "61-63", "40-41", "150-160", "-"],
      ["M", "63-66", "41-44", "160-165", "-"],
      ["G", "66-69", "44-47", "165-170", "-"],
      ["GG", "69-71", "47-50", "170-175", "-"],
    ],
  },
  infantil: {
    key: "infantil",
    shortLabel: "Infantil",
    title: "Kit Infantil",
    columns: ["Tam", "Idade", "Largura", "Altura", "Compr.", "Cintu."],
    rows: [
      ["16", "3-4", "35-37", "95-105", "44-47", "20-37"],
      ["18", "4-5", "37-39", "105-115", "47-50", "21-39"],
      ["20", "5-6", "39-41", "115-125", "50-53", "22-41"],
      ["22", "6-7", "41-43", "125-135", "53-56", "23-42"],
      ["24", "8-9", "43-45", "135-145", "56-59", "24-44"],
      ["26", "10-11", "45-47", "145-155", "59-62", "25-47"],
      ["28", "12-13", "47-49", "155-165", "62-65", "26-50"],
    ],
  },
  basquete: {
    key: "basquete",
    shortLabel: "Basquete",
    title: "Regatas de Basquete - Silk",
    columns: ["Tam", "Compr.", "Busto", "Ombros", "Altura", "Peso"],
    rows: [
      ["P", "70", "98", "35", "160-170", "90-115"],
      ["M", "72", "106", "37", "168-175", "115-135"],
      ["G", "75", "112", "39", "172-180", "145-165"],
      ["GG", "77", "120", "41", "178-185", "165-185"],
      ["2XL", "80", "130", "44", "183-200", "180-210"],
    ],
  },
};

const GUIDE_ORDER: GuideKey[] = ["torcedor", "jogador", "feminino", "infantil", "basquete"];

function guideKeyForType(type: ProductCommercialType | null | undefined): GuideKey | null {
  if (
    type === "torcedor" ||
    type === "jogador" ||
    type === "feminino" ||
    type === "infantil" ||
    type === "basquete"
  ) {
    return type;
  }
  return null;
}

function GuideTable({ guide }: { guide: SizeGuide }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-800 bg-[#111] text-white">
      <div className="border-b border-neutral-700 bg-[#191919] px-4 py-4 text-center">
        <h3 className="text-base font-black uppercase tracking-wide sm:text-lg">{guide.title}</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-center text-xs sm:text-sm">
          <thead>
            <tr className="text-red-500">
              {guide.columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="border-b border-r border-neutral-700 px-3 py-3 font-black uppercase last:border-r-0"
                >
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {guide.rows.map((row) => (
              <tr key={`${guide.key}-${row[0]}`} className="text-neutral-200">
                {row.map((value, index) => (
                  <td
                    key={`${row[0]}-${guide.columns[index]}`}
                    className={`border-b border-r border-neutral-700 px-3 py-3 font-bold last:border-r-0 ${
                      index === 0 ? "text-base font-black" : ""
                    }`}
                  >
                    {value}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SizeGuideDialog({
  commercialType,
  productId,
  triggerLabel = "Guia de tamanhos",
  compact = false,
}: {
  commercialType?: ProductCommercialType | null;
  productId?: string | null;
  triggerLabel?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [resolvedType, setResolvedType] = useState<ProductCommercialType | null>(commercialType ?? null);
  const [loadingType, setLoadingType] = useState(false);
  const [activeKey, setActiveKey] = useState<GuideKey>(guideKeyForType(commercialType) ?? "torcedor");

  const automaticKey = useMemo(() => guideKeyForType(resolvedType), [resolvedType]);

  useEffect(() => {
    setResolvedType(commercialType ?? null);
    const next = guideKeyForType(commercialType);
    if (next) setActiveKey(next);
  }, [commercialType]);

  useEffect(() => {
    if (!open || commercialType || !productId) return;

    let active = true;
    setLoadingType(true);
    void fetchProductPurchaseConfig(productId)
      .then((config) => {
        if (!active) return;
        setResolvedType(config.commercialType);
        const next = guideKeyForType(config.commercialType);
        if (next) setActiveKey(next);
      })
      .finally(() => {
        if (active) setLoadingType(false);
      });

    return () => {
      active = false;
    };
  }, [commercialType, open, productId]);

  const knownUnsupported = Boolean(resolvedType && !automaticKey);
  const shouldRenderTrigger = commercialType ? Boolean(guideKeyForType(commercialType)) : true;

  if (!shouldRenderTrigger) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={
            compact
              ? "inline-flex items-center gap-1.5 text-[11px] font-bold text-red-600 underline-offset-4 hover:underline"
              : "inline-flex items-center gap-1.5 text-xs font-bold text-red-600 underline-offset-4 hover:underline"
          }
        >
          <Ruler className="h-3.5 w-3.5" aria-hidden="true" />
          {triggerLabel}
        </button>
      </DialogTrigger>

      <DialogContent className="bottom-0 left-0 top-auto max-h-[90vh] w-full max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-b-none rounded-t-3xl border-gray-200 bg-white p-4 sm:bottom-auto sm:left-[50%] sm:top-[50%] sm:w-[calc(100vw-2rem)] sm:max-w-3xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:p-6">
        <DialogHeader className="pr-7 text-left">
          <DialogTitle className="flex items-center gap-2 text-xl font-black text-gray-950">
            <Ruler className="h-5 w-5 text-red-600" aria-hidden="true" />
            Guia de tamanhos
          </DialogTitle>
          <DialogDescription className="text-sm leading-5">
            A tabela correspondente a este produto é selecionada automaticamente. Você também pode
            consultar as outras referências abaixo.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-950 sm:text-sm">
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />
            <p>
              <strong>Aviso:</strong> as medidas informadas são aproximadas e podem apresentar
              variação de até 2 a 3 cm, para mais ou para menos, conforme o molde utilizado.
            </p>
          </div>
        </div>

        {loadingType ? (
          <div className="flex min-h-24 items-center justify-center gap-2 text-sm font-semibold text-gray-500">
            <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
            Identificando a tabela deste produto...
          </div>
        ) : (
          <>
            {knownUnsupported ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-600">
                Este tipo de produto não possui uma tabela específica entre as referências
                fornecidas. As outras tabelas continuam disponíveis para consulta abaixo.
              </div>
            ) : automaticKey ? (
              <p className="text-xs font-semibold text-emerald-700">
                Tabela recomendada para este produto: {SIZE_GUIDES[automaticKey].title}.
              </p>
            ) : null}

            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Tabelas de medidas">
              {GUIDE_ORDER.map((key) => {
                const guide = SIZE_GUIDES[key];
                const selected = activeKey === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveKey(key)}
                    className={`shrink-0 rounded-full border px-3 py-2 text-xs font-black transition-colors ${
                      selected
                        ? "border-red-600 bg-red-600 text-white"
                        : "border-gray-200 bg-white text-gray-700 hover:border-red-300 hover:text-red-700"
                    }`}
                  >
                    {guide.shortLabel}
                  </button>
                );
              })}
            </div>

            <GuideTable guide={SIZE_GUIDES[activeKey]} />

            <div className="grid gap-3 rounded-xl bg-gray-50 p-4 text-xs leading-5 text-gray-600 sm:grid-cols-2">
              <p>
                <strong className="block text-gray-950">Como comparar</strong>
                Use uma peça que já veste bem, estenda-a em uma superfície plana e compare as
                medidas com a tabela.
              </p>
              <p>
                <strong className="block text-gray-950">Importante</strong>
                As faixas acima reproduzem as referências fornecidas. Em caso de dúvida entre dois
                tamanhos, considere o caimento que você prefere.
              </p>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
