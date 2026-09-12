import { useRef, type MouseEvent } from "react";

import { CatalogFoundationAdmin } from "@/components/admin/CatalogFoundationAdmin";
import { ProductPurchaseAdmin } from "@/components/admin/ProductPurchaseAdmin";

function normalizeLabel(value: string | null | undefined) {
  return (value ?? "").replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}

function scrollToNewProductEditor(root: HTMLElement, attempt = 0) {
  window.requestAnimationFrame(() => {
    const heading = Array.from(root.querySelectorAll("h2")).find(
      (element) => normalizeLabel(element.textContent) === "novo produto",
    );
    const editor = heading?.closest(".rounded-xl");

    if (!(editor instanceof HTMLElement)) {
      if (attempt < 5) scrollToNewProductEditor(root, attempt + 1);
      return;
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    editor.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "start",
    });

    window.requestAnimationFrame(() => {
      const firstField = editor.querySelector(
        'input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])',
      );
      if (firstField instanceof HTMLElement) firstField.focus({ preventScroll: true });
    });
  });
}

export function ProductsAdminWorkspace() {
  const rootRef = useRef<HTMLDivElement>(null);

  function handleClickCapture(event: MouseEvent<HTMLDivElement>) {
    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest("button");
    if (!button) return;

    const label = normalizeLabel(button.textContent);
    if (label !== "novo produto" && label !== "adicionar produto") return;

    const root = rootRef.current;
    if (!root) return;

    scrollToNewProductEditor(root);
  }

  return (
    <div ref={rootRef} onClickCapture={handleClickCapture}>
      <CatalogFoundationAdmin />
      <ProductPurchaseAdmin />
    </div>
  );
}
