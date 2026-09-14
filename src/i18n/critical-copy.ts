export type CriticalLocale =
  | "pt"
  | "en"
  | "es"
  | "fr"
  | "de"
  | "it"
  | "nl"
  | "ja"
  | "ko"
  | "zh"
  | "ar";

const localeOrder = ["en", "es", "fr", "de", "it", "nl", "ja", "ko", "zh", "ar"] as const;

type ForeignLocale = (typeof localeOrder)[number];

const rows: Record<string, readonly string[]> = {
  "Idioma": ["Language", "Idioma", "Langue", "Sprache", "Lingua", "Taal", "言語", "언어", "语言", "اللغة"],
  "Início": ["Home", "Inicio", "Accueil", "Startseite", "Home", "Home", "ホーム", "홈", "首页", "الرئيسية"],
  "Produtos": ["Products", "Productos", "Produits", "Produkte", "Prodotti", "Producten", "商品", "상품", "商品", "المنتجات"],
  "Filtros": ["Filters", "Filtros", "Filtres", "Filter", "Filtri", "Filters", "フィルター", "필터", "筛选", "الفلاتر"],
  "Ordenar": ["Sort", "Ordenar", "Trier", "Sortieren", "Ordina", "Sorteren", "並び替え", "정렬", "排序", "الترتيب"],
  "Destaques": ["Featured", "Destacados", "À la une", "Highlights", "In evidenza", "Uitgelicht", "おすすめ", "추천", "精选", "مميز"],
  "Limpar tudo": ["Clear all", "Limpiar todo", "Tout effacer", "Alles löschen", "Cancella tutto", "Alles wissen", "すべてクリア", "모두 지우기", "全部清除", "مسح الكل"],
  "Buscar": ["Search", "Buscar", "Rechercher", "Suchen", "Cerca", "Zoeken", "検索", "검색", "搜索", "بحث"],
  "Buscar produtos": ["Search products", "Buscar productos", "Rechercher des produits", "Produkte suchen", "Cerca prodotti", "Producten zoeken", "商品を検索", "상품 검색", "搜索商品", "البحث عن المنتجات"],
  "Minha conta": ["My account", "Mi cuenta", "Mon compte", "Mein Konto", "Il mio account", "Mijn account", "マイアカウント", "내 계정", "我的账户", "حسابي"],
  "Carrinho": ["Cart", "Carrito", "Panier", "Warenkorb", "Carrello", "Winkelwagen", "カート", "장바구니", "购物车", "السلة"],

  "Novidades da loja": ["Store news", "Novedades de la tienda", "Nouveautés de la boutique", "Neu im Shop", "Novità del negozio", "Nieuw in de winkel", "ストアの新着", "스토어 신상품", "商店新品", "جديد المتجر"],
  "Novidades DropBox": ["DropBox news", "Novedades DropBox", "Nouveautés DropBox", "DropBox Neuheiten", "Novità DropBox", "DropBox-nieuws", "DropBox 新着", "DropBox 신상품", "DropBox 新品", "جديد DropBox"],
  "Lançamentos": ["New arrivals", "Novedades", "Nouveautés", "Neuheiten", "Novità", "Nieuw", "新着商品", "신상품", "新品", "وصل حديثاً"],
  "Monte seu pedido": ["Build your order", "Arma tu pedido", "Composez votre commande", "Stell deine Bestellung zusammen", "Crea il tuo ordine", "Stel je bestelling samen", "注文を組み立てる", "주문 구성하기", "搭配你的订单", "كوّن طلبك"],
  "Escolha seu estilo": ["Choose your style", "Elige tu estilo", "Choisissez votre style", "Wähle deinen Stil", "Scegli il tuo stile", "Kies je stijl", "スタイルを選ぶ", "스타일 선택", "选择你的风格", "اختر أسلوبك"],
  "Encontre seu time": ["Find your team", "Encuentra tu equipo", "Trouvez votre équipe", "Finde dein Team", "Trova la tua squadra", "Vind je team", "チームを探す", "팀 찾기", "找到你的球队", "اعثر على فريقك"],
  "Futebol brasileiro": ["Brazilian football", "Fútbol brasileño", "Football brésilien", "Brasilianischer Fußball", "Calcio brasiliano", "Braziliaans voetbal", "ブラジルサッカー", "브라질 축구", "巴西足球", "كرة القدم البرازيلية"],
  "Compre por liga": ["Shop by league", "Compra por liga", "Achetez par ligue", "Nach Liga shoppen", "Acquista per lega", "Shop per competitie", "リーグから探す", "리그별 쇼핑", "按联赛选购", "تسوق حسب الدوري"],
  "Futebol internacional": ["International football", "Fútbol internacional", "Football international", "Internationaler Fußball", "Calcio internazionale", "Internationaal voetbal", "海外サッカー", "해외 축구", "国际足球", "كرة القدم العالمية"],
  "Perguntas frequentes": ["Frequently asked questions", "Preguntas frecuentes", "Questions fréquentes", "Häufige Fragen", "Domande frequenti", "Veelgestelde vragen", "よくある質問", "자주 묻는 질문", "常见问题", "الأسئلة الشائعة"],
  "Antes de comprar": ["Before you buy", "Antes de comprar", "Avant d’acheter", "Vor dem Kauf", "Prima di acquistare", "Voor je koopt", "購入前に", "구매 전 확인", "购买前", "قبل الشراء"],

  "Tamanho": ["Size", "Talla", "Taille", "Größe", "Taglia", "Maat", "サイズ", "사이즈", "尺码", "المقاس"],
  "Ver guia de tamanhos": ["View size guide", "Ver guía de tallas", "Voir le guide des tailles", "Größentabelle ansehen", "Vedi guida alle taglie", "Maattabel bekijken", "サイズガイドを見る", "사이즈 가이드 보기", "查看尺码指南", "عرض دليل المقاسات"],
  "Guia de tamanhos": ["Size guide", "Guía de tallas", "Guide des tailles", "Größentabelle", "Guida alle taglie", "Maattabel", "サイズガイド", "사이즈 가이드", "尺码指南", "دليل المقاسات"],
  "Personalizar": ["Customize", "Personalizar", "Personnaliser", "Personalisieren", "Personalizza", "Personaliseren", "カスタマイズ", "커스터마이즈", "个性定制", "تخصيص"],
  "Não": ["No", "No", "Non", "Nein", "No", "Nee", "いいえ", "아니요", "否", "لا"],
  "Sim": ["Yes", "Sí", "Oui", "Ja", "Sì", "Ja", "はい", "예", "是", "نعم"],
  "Patches": ["Patches", "Parches", "Patchs", "Patches", "Patch", "Patches", "パッチ", "패치", "臂章", "الشارات"],
  "Frase personalizada": ["Custom phrase", "Frase personalizada", "Phrase personnalisée", "Individueller Text", "Frase personalizzata", "Aangepaste tekst", "カスタムフレーズ", "맞춤 문구", "自定义短语", "عبارة مخصصة"],
  "Nome e número": ["Name and number", "Nombre y número", "Nom et numéro", "Name und Nummer", "Nome e numero", "Naam en nummer", "名前と番号", "이름과 번호", "姓名和号码", "الاسم والرقم"],
  "Compartilhar": ["Share", "Compartir", "Partager", "Teilen", "Condividi", "Delen", "共有", "공유", "分享", "مشاركة"],
  "Copiar link": ["Copy link", "Copiar enlace", "Copier le lien", "Link kopieren", "Copia link", "Link kopiëren", "リンクをコピー", "링크 복사", "复制链接", "نسخ الرابط"],
  "Calcule a entrega": ["Calculate delivery", "Calcular entrega", "Calculer la livraison", "Lieferung berechnen", "Calcola consegna", "Bezorging berekenen", "配送を計算", "배송 계산", "计算配送", "احسب التوصيل"],
  "Calcular": ["Calculate", "Calcular", "Calculer", "Berechnen", "Calcola", "Berekenen", "計算する", "계산", "计算", "احسب"],
  "CEP": ["Postal code", "Código postal", "Code postal", "Postleitzahl", "CAP", "Postcode", "郵便番号", "우편번호", "邮政编码", "الرمز البريدي"],
  "Ampliar": ["Enlarge", "Ampliar", "Agrandir", "Vergrößern", "Ingrandisci", "Vergroten", "拡大", "확대", "放大", "تكبير"],
  "Sob encomenda": ["Made to order", "Bajo pedido", "Sur commande", "Auf Bestellung", "Su ordinazione", "Op bestelling", "受注販売", "주문 제작", "按单制作", "حسب الطلب"],
  "Modelo": ["Model", "Modelo", "Modèle", "Modell", "Modello", "Model", "モデル", "모델", "款式", "الموديل"],
  "Versão": ["Version", "Versión", "Version", "Version", "Versione", "Versie", "バージョン", "버전", "版本", "الإصدار"],
  "Versões disponíveis": ["Available versions", "Versiones disponibles", "Versions disponibles", "Verfügbare Versionen", "Versioni disponibili", "Beschikbare versies", "選べるバージョン", "선택 가능한 버전", "可选版本", "الإصدارات المتاحة"],
  "Categoria": ["Category", "Categoría", "Catégorie", "Kategorie", "Categoria", "Categorie", "カテゴリー", "카테고리", "类别", "الفئة"],
  "Time": ["Team", "Equipo", "Équipe", "Team", "Squadra", "Team", "チーム", "팀", "球队", "الفريق"],
  "Liga": ["League", "Liga", "Ligue", "Liga", "Lega", "Competitie", "リーグ", "리그", "联赛", "الدوري"],
  "Campeonato": ["Competition", "Campeonato", "Compétition", "Wettbewerb", "Campionato", "Competitie", "大会", "대회", "赛事", "البطولة"],
  "Temporada": ["Season", "Temporada", "Saison", "Saison", "Stagione", "Seizoen", "シーズン", "시즌", "赛季", "الموسم"],
  "Marca": ["Brand", "Marca", "Marque", "Marke", "Marca", "Merk", "ブランド", "브랜드", "品牌", "العلامة التجارية"],
  "Detalhe": ["Detail", "Detalle", "Détail", "Detail", "Dettaglio", "Detail", "詳細", "상세", "详情", "التفاصيل"],
  "Adicionar ao carrinho": ["Add to cart", "Añadir al carrito", "Ajouter au panier", "In den Warenkorb", "Aggiungi al carrello", "In winkelwagen", "カートに追加", "장바구니에 담기", "加入购物车", "أضف إلى السلة"],
  "Escolha as opções": ["Choose options", "Elige las opciones", "Choisissez les options", "Optionen wählen", "Scegli le opzioni", "Kies opties", "オプションを選択", "옵션 선택", "选择选项", "اختر الخيارات"],
  "Selecione as opções": ["Select options", "Selecciona las opciones", "Sélectionnez les options", "Optionen auswählen", "Seleziona le opzioni", "Selecteer opties", "オプションを選択", "옵션을 선택하세요", "请选择选项", "حدد الخيارات"],
  "Indisponível": ["Unavailable", "No disponible", "Indisponible", "Nicht verfügbar", "Non disponibile", "Niet beschikbaar", "在庫なし", "이용 불가", "不可用", "غير متاح"],

  "Atendimento": ["Support", "Atención", "Assistance", "Kundenservice", "Assistenza", "Klantenservice", "サポート", "고객지원", "客服", "الدعم"],
  "Envio e produção": ["Shipping and production", "Envío y producción", "Expédition et production", "Versand und Produktion", "Spedizione e produzione", "Verzending en productie", "発送と製造", "배송 및 제작", "配送与制作", "الشحن والإنتاج"],
  "Trocas e devoluções": ["Exchanges and returns", "Cambios y devoluciones", "Échanges et retours", "Umtausch und Rückgabe", "Cambi e resi", "Ruilen en retourneren", "交換・返品", "교환 및 반품", "换货与退货", "الاستبدال والإرجاع"],
  "Termos de compra": ["Purchase terms", "Términos de compra", "Conditions d’achat", "Kaufbedingungen", "Termini di acquisto", "Aankoopvoorwaarden", "購入規約", "구매 약관", "购买条款", "شروط الشراء"],
  "Privacidade": ["Privacy", "Privacidad", "Confidentialité", "Datenschutz", "Privacy", "Privacy", "プライバシー", "개인정보", "隐私", "الخصوصية"],
  "Formas de pagamento": ["Payment methods", "Métodos de pago", "Moyens de paiement", "Zahlungsarten", "Metodi di pagamento", "Betaalmethoden", "お支払い方法", "결제 수단", "支付方式", "طرق الدفع"],
  "Todos os direitos reservados.": ["All rights reserved.", "Todos los derechos reservados.", "Tous droits réservés.", "Alle Rechte vorbehalten.", "Tutti i diritti riservati.", "Alle rechten voorbehouden.", "無断転載を禁じます。", "모든 권리 보유.", "版权所有。", "جميع الحقوق محفوظة."],

  "Aceitar todos": ["Accept all", "Aceptar todo", "Tout accepter", "Alle akzeptieren", "Accetta tutto", "Alles accepteren", "すべて許可", "모두 허용", "全部接受", "قبول الكل"],
  "Rejeitar opcionais": ["Reject optional", "Rechazar opcionales", "Refuser les options", "Optionale ablehnen", "Rifiuta opzionali", "Optionele weigeren", "任意項目を拒否", "선택 항목 거부", "拒绝可选项", "رفض الاختياري"],
  "Preferências": ["Preferences", "Preferencias", "Préférences", "Einstellungen", "Preferenze", "Voorkeuren", "設定", "환경설정", "偏好设置", "التفضيلات"],
  "Salvar preferências": ["Save preferences", "Guardar preferencias", "Enregistrer les préférences", "Einstellungen speichern", "Salva preferenze", "Voorkeuren opslaan", "設定を保存", "설정 저장", "保存偏好", "حفظ التفضيلات"],

  "Finalizar compra": ["Checkout", "Finalizar compra", "Passer la commande", "Zur Kasse", "Vai al checkout", "Afrekenen", "購入手続きへ", "결제하기", "去结算", "إتمام الشراء"],
  "Continuar comprando": ["Continue shopping", "Seguir comprando", "Continuer mes achats", "Weiter einkaufen", "Continua lo shopping", "Verder winkelen", "買い物を続ける", "쇼핑 계속하기", "继续购物", "متابعة التسوق"],
  "Resumo do pedido": ["Order summary", "Resumen del pedido", "Récapitulatif de la commande", "Bestellübersicht", "Riepilogo ordine", "Besteloverzicht", "注文概要", "주문 요약", "订单摘要", "ملخص الطلب"],
  "Subtotal": ["Subtotal", "Subtotal", "Sous-total", "Zwischensumme", "Subtotale", "Subtotaal", "小計", "소계", "小计", "المجموع الفرعي"],
  "Frete": ["Shipping", "Envío", "Livraison", "Versand", "Spedizione", "Verzending", "送料", "배송", "运费", "الشحن"],
  "Desconto": ["Discount", "Descuento", "Réduction", "Rabatt", "Sconto", "Korting", "割引", "할인", "折扣", "الخصم"],
  "Total": ["Total", "Total", "Total", "Gesamt", "Totale", "Totaal", "合計", "합계", "总计", "الإجمالي"],
  "Quantidade": ["Quantity", "Cantidad", "Quantité", "Menge", "Quantità", "Aantal", "数量", "수량", "数量", "الكمية"],
  "Remover": ["Remove", "Eliminar", "Supprimer", "Entfernen", "Rimuovi", "Verwijderen", "削除", "삭제", "移除", "إزالة"],
  "Entrega": ["Delivery", "Entrega", "Livraison", "Lieferung", "Consegna", "Bezorging", "配送", "배송", "配送", "التوصيل"],
  "Pagamento": ["Payment", "Pago", "Paiement", "Zahlung", "Pagamento", "Betaling", "お支払い", "결제", "支付", "الدفع"],
  "Endereço": ["Address", "Dirección", "Adresse", "Adresse", "Indirizzo", "Adres", "住所", "주소", "地址", "العنوان"],
  "Dados pessoais": ["Personal details", "Datos personales", "Données personnelles", "Persönliche Daten", "Dati personali", "Persoonsgegevens", "個人情報", "개인 정보", "个人信息", "البيانات الشخصية"],

  "Entrar": ["Sign in", "Iniciar sesión", "Se connecter", "Anmelden", "Accedi", "Inloggen", "ログイン", "로그인", "登录", "تسجيل الدخول"],
  "Criar conta": ["Create account", "Crear cuenta", "Créer un compte", "Konto erstellen", "Crea account", "Account maken", "アカウント作成", "계정 만들기", "创建账户", "إنشاء حساب"],
  "E-mail": ["Email", "Correo electrónico", "E-mail", "E-Mail", "E-mail", "E-mail", "メールアドレス", "이메일", "电子邮箱", "البريد الإلكتروني"],
  "Senha": ["Password", "Contraseña", "Mot de passe", "Passwort", "Password", "Wachtwoord", "パスワード", "비밀번호", "密码", "كلمة المرور"],
  "Sair": ["Sign out", "Salir", "Se déconnecter", "Abmelden", "Esci", "Uitloggen", "ログアウト", "로그아웃", "退出登录", "تسجيل الخروج"],
  "Pedidos": ["Orders", "Pedidos", "Commandes", "Bestellungen", "Ordini", "Bestellingen", "注文", "주문", "订单", "الطلبات"],
  "Endereços": ["Addresses", "Direcciones", "Adresses", "Adressen", "Indirizzi", "Adressen", "住所", "주소", "地址", "العناوين"],
  "Segurança": ["Security", "Seguridad", "Sécurité", "Sicherheit", "Sicurezza", "Beveiliging", "セキュリティ", "보안", "安全", "الأمان"],
  "Afiliados": ["Affiliates", "Afiliados", "Affiliés", "Partner", "Affiliati", "Affiliates", "アフィリエイト", "제휴", "联盟推广", "المسوقون بالعمولة"],
  "Administração": ["Administration", "Administración", "Administration", "Verwaltung", "Amministrazione", "Beheer", "管理", "관리", "管理", "الإدارة"],
  "Financeiro": ["Finance", "Finanzas", "Finances", "Finanzen", "Finanze", "Financiën", "財務", "재무", "财务", "المالية"],
  "Voltar": ["Back", "Volver", "Retour", "Zurück", "Indietro", "Terug", "戻る", "뒤로", "返回", "رجوع"],
  "Continuar": ["Continue", "Continuar", "Continuer", "Weiter", "Continua", "Doorgaan", "続ける", "계속", "继续", "متابعة"],
  "Confirmar": ["Confirm", "Confirmar", "Confirmer", "Bestätigen", "Conferma", "Bevestigen", "確認", "확인", "确认", "تأكيد"],
  "Salvar": ["Save", "Guardar", "Enregistrer", "Speichern", "Salva", "Opslaan", "保存", "저장", "保存", "حفظ"],
  "Cancelar": ["Cancel", "Cancelar", "Annuler", "Abbrechen", "Annulla", "Annuleren", "キャンセル", "취소", "取消", "إلغاء"],
  "Fechar": ["Close", "Cerrar", "Fermer", "Schließen", "Chiudi", "Sluiten", "閉じる", "닫기", "关闭", "إغلاق"],
  "Carregando...": ["Loading...", "Cargando...", "Chargement...", "Wird geladen...", "Caricamento...", "Laden...", "読み込み中...", "불러오는 중...", "加载中...", "جارٍ التحميل..."],
  "Tentar novamente": ["Try again", "Intentar de nuevo", "Réessayer", "Erneut versuchen", "Riprova", "Opnieuw proberen", "再試行", "다시 시도", "重试", "حاول مرة أخرى"],
};

const normalizedRows = new Map(
  Object.entries(rows).map(([source, translations]) => [normalizeKey(source), translations]),
);

function normalizeKey(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}

function looksUppercase(value: string) {
  const letters = value.replace(/[^\p{L}]/gu, "");
  return letters.length > 1 && letters === letters.toLocaleUpperCase("pt-BR");
}

export function criticalCopy(locale: CriticalLocale, source: string) {
  if (locale === "pt") return source;
  const translations = normalizedRows.get(normalizeKey(source));
  if (!translations) return null;
  const index = localeOrder.indexOf(locale as ForeignLocale);
  if (index < 0) return null;
  const translated = translations[index];
  if (!translated) return null;
  return looksUppercase(source) ? translated.toLocaleUpperCase(locale) : translated;
}

export const CRITICAL_COPY_SOURCES = Object.freeze(Object.keys(rows));
