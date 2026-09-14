import type { Locale } from "@/i18n";

const NON_PT_LOCALES = ["en", "es", "fr", "de", "it", "nl", "ja", "ko", "zh", "ar"] as const;
type NonPtLocale = (typeof NON_PT_LOCALES)[number];
type Row = readonly [string, string, string, string, string, string, string, string, string, string];

const COPY: Record<string, Row> = {
  "Produto não encontrado": ["Product not found", "Producto no encontrado", "Produit introuvable", "Produkt nicht gefunden", "Prodotto non trovato", "Product niet gevonden", "商品が見つかりません", "상품을 찾을 수 없습니다", "未找到商品", "المنتج غير موجود"],
  "O produto pode ter sido removido, estar indisponível ou o link pode estar incorreto.": ["The product may have been removed, be unavailable, or the link may be incorrect.", "El producto puede haber sido eliminado, no estar disponible o el enlace puede ser incorrecto.", "Le produit a peut-être été supprimé, est indisponible ou le lien est incorrect.", "Das Produkt wurde möglicherweise entfernt, ist nicht verfügbar oder der Link ist falsch.", "Il prodotto potrebbe essere stato rimosso, non essere disponibile oppure il link potrebbe essere errato.", "Het product is mogelijk verwijderd, niet beschikbaar of de link is onjuist.", "商品が削除された、現在利用できない、またはリンクが正しくない可能性があります。", "상품이 삭제되었거나 현재 이용할 수 없거나 링크가 올바르지 않을 수 있습니다.", "该商品可能已被移除、暂不可用，或链接有误。", "قد يكون المنتج قد أزيل أو غير متاح حاليًا أو أن الرابط غير صحيح."],
  "Voltar para Produtos": ["Back to Products", "Volver a Productos", "Retour aux produits", "Zurück zu Produkten", "Torna ai prodotti", "Terug naar producten", "商品一覧に戻る", "상품으로 돌아가기", "返回商品列表", "العودة إلى المنتجات"],
  "Sob encomenda": ["Made to order", "Bajo pedido", "Sur commande", "Auf Bestellung", "Su ordinazione", "Op bestelling", "受注商品", "주문 제작", "按单制作", "حسب الطلب"],
  "Combinação indisponível": ["Combination unavailable", "Combinación no disponible", "Combinaison indisponible", "Kombination nicht verfügbar", "Combinazione non disponibile", "Combinatie niet beschikbaar", "この組み合わせは利用できません", "선택한 조합을 이용할 수 없습니다", "该组合暂不可用", "هذه التركيبة غير متاحة"],
  "Selecione uma opção": ["Select an option", "Selecciona una opción", "Sélectionnez une option", "Wähle eine Option", "Seleziona un'opzione", "Kies een optie", "オプションを選択", "옵션을 선택하세요", "请选择一个选项", "اختر خيارًا"],
  "Selecione as opções": ["Select the options", "Selecciona las opciones", "Sélectionnez les options", "Wähle die Optionen", "Seleziona le opzioni", "Kies de opties", "オプションを選択", "옵션을 선택하세요", "请选择选项", "اختر الخيارات"],
  "Escolha as opções": ["Choose options", "Elige las opciones", "Choisissez les options", "Optionen wählen", "Scegli le opzioni", "Kies opties", "オプションを選ぶ", "옵션 선택", "选择选项", "اختر الخيارات"],
  "Indisponível": ["Unavailable", "No disponible", "Indisponible", "Nicht verfügbar", "Non disponibile", "Niet beschikbaar", "利用できません", "이용 불가", "暂不可用", "غير متاح"],
  "Adicionar ao carrinho": ["Add to cart", "Añadir al carrito", "Ajouter au panier", "In den Warenkorb", "Aggiungi al carrello", "In winkelwagen", "カートに追加", "장바구니에 담기", "加入购物车", "أضف إلى السلة"],
  "Selecione as opções do produto antes de continuar.": ["Select the product options before continuing.", "Selecciona las opciones del producto antes de continuar.", "Sélectionnez les options du produit avant de continuer.", "Wähle die Produktoptionen aus, bevor du fortfährst.", "Seleziona le opzioni del prodotto prima di continuare.", "Selecteer de productopties voordat je doorgaat.", "続行する前に商品のオプションを選択してください。", "계속하기 전에 상품 옵션을 선택하세요.", "继续前请选择商品选项。", "اختر خيارات المنتج قبل المتابعة."],
  "As opções de compra ainda estão carregando.": ["Purchase options are still loading.", "Las opciones de compra aún se están cargando.", "Les options d'achat sont encore en cours de chargement.", "Die Kaufoptionen werden noch geladen.", "Le opzioni di acquisto si stanno ancora caricando.", "De aankoopopties worden nog geladen.", "購入オプションを読み込み中です。", "구매 옵션을 불러오는 중입니다.", "购买选项仍在加载中。", "ما زالت خيارات الشراء قيد التحميل."],
  "Diminuir quantidade": ["Decrease quantity", "Reducir cantidad", "Diminuer la quantité", "Menge verringern", "Riduci quantità", "Aantal verlagen", "数量を減らす", "수량 줄이기", "减少数量", "تقليل الكمية"],
  "Aumentar quantidade": ["Increase quantity", "Aumentar cantidad", "Augmenter la quantité", "Menge erhöhen", "Aumenta quantità", "Aantal verhogen", "数量を増やす", "수량 늘리기", "增加数量", "زيادة الكمية"],
  "Produção em até 5 dias úteis antes do envio": ["Production takes up to 5 business days before shipping", "Producción de hasta 5 días hábiles antes del envío", "Production sous 5 jours ouvrés maximum avant expédition", "Produktion innerhalb von bis zu 5 Werktagen vor dem Versand", "Produzione entro 5 giorni lavorativi prima della spedizione", "Productie binnen maximaal 5 werkdagen vóór verzending", "発送前の製作期間は最大5営業日です", "배송 전 제작 기간은 최대 5영업일입니다", "发货前生产时间最长为 5 个工作日", "الإنتاج خلال مدة تصل إلى 5 أيام عمل قبل الشحن"],
  "Especificações": ["Specifications", "Especificaciones", "Caractéristiques", "Spezifikationen", "Specifiche", "Specificaties", "仕様", "상세 사양", "规格", "المواصفات"],
  "Detalhes do produto": ["Product details", "Detalles del producto", "Détails du produit", "Produktdetails", "Dettagli del prodotto", "Productdetails", "商品詳細", "상품 상세", "商品详情", "تفاصيل المنتج"],
  "Você também pode gostar": ["You may also like", "También te puede gustar", "Vous aimerez peut-être aussi", "Das könnte dir auch gefallen", "Potrebbe piacerti anche", "Dit vind je misschien ook leuk", "こちらもおすすめ", "이 상품도 추천해요", "你可能还喜欢", "قد يعجبك أيضًا"],
  "Produtos relacionados": ["Related products", "Productos relacionados", "Produits associés", "Ähnliche Produkte", "Prodotti correlati", "Gerelateerde producten", "関連商品", "관련 상품", "相关商品", "منتجات ذات صلة"],
  "Ver catálogo": ["View catalog", "Ver catálogo", "Voir le catalogue", "Katalog ansehen", "Vedi catalogo", "Catalogus bekijken", "カタログを見る", "카탈로그 보기", "查看目录", "عرض الكتالوج"],
  "Valor por peça": ["Price per item", "Precio por pieza", "Prix par article", "Preis pro Artikel", "Prezzo per articolo", "Prijs per stuk", "1点あたりの価格", "개당 가격", "单件价格", "السعر للقطعة"],
  "Variação": ["Variant", "Variante", "Variante", "Variante", "Variante", "Variant", "バリエーション", "옵션", "款式", "الخيار"],
  "Selecionar variação": ["Select variant", "Seleccionar variante", "Sélectionner la variante", "Variante auswählen", "Seleziona variante", "Variant selecteren", "バリエーションを選択", "옵션 선택", "选择款式", "اختر الخيار"],
  "Categoria": ["Category", "Categoría", "Catégorie", "Kategorie", "Categoria", "Categorie", "カテゴリー", "카테고리", "分类", "الفئة"],
  "Time": ["Team", "Equipo", "Équipe", "Team", "Squadra", "Team", "チーム", "팀", "球队", "الفريق"],
  "Liga": ["League", "Liga", "Ligue", "Liga", "Campionato", "Competitie", "リーグ", "리그", "联赛", "الدوري"],
  "Campeonato": ["Competition", "Competición", "Compétition", "Wettbewerb", "Competizione", "Competitie", "大会", "대회", "赛事", "البطولة"],
  "Temporada": ["Season", "Temporada", "Saison", "Saison", "Stagione", "Seizoen", "シーズン", "시즌", "赛季", "الموسم"],
  "Marca": ["Brand", "Marca", "Marque", "Marke", "Marca", "Merk", "ブランド", "브랜드", "品牌", "العلامة التجارية"],
  "Detalhe": ["Detail", "Detalle", "Détail", "Detail", "Dettaglio", "Detail", "詳細", "세부 정보", "详情", "التفصيل"],
  "Versão": ["Version", "Versión", "Version", "Version", "Versione", "Versie", "バージョン", "버전", "版本", "الإصدار"],
  "Versões disponíveis": ["Available versions", "Versiones disponibles", "Versions disponibles", "Verfügbare Versionen", "Versioni disponibili", "Beschikbare versies", "選択可能なバージョン", "사용 가능한 버전", "可选版本", "الإصدارات المتاحة"],
  "Produto": ["Product", "Producto", "Produit", "Produkt", "Prodotto", "Product", "商品", "상품", "商品", "المنتج"],
};

function localeIndex(locale: Locale) {
  return NON_PT_LOCALES.indexOf(locale as NonPtLocale);
}

export function productCopy(locale: Locale, source: string) {
  if (locale === "pt") return source;
  const row = COPY[source];
  if (!row) return source;
  const index = localeIndex(locale);
  return index >= 0 ? row[index] : source;
}

export const PRODUCT_COPY_SOURCES = Object.freeze(Object.keys(COPY));
