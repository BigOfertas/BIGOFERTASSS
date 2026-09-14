import type { Locale } from "@/i18n";

const NON_PT_LOCALES = ["en", "es", "fr", "de", "it", "nl", "ja", "ko", "zh", "ar"] as const;
type NonPtLocale = (typeof NON_PT_LOCALES)[number];
type TranslationRow = readonly [string, string, string, string, string, string, string, string, string, string];

const COPY: Record<string, TranslationRow> = {
  // Homepage and shared editorial headings. These must be translated before reveal animations split them.
  "Monte seu pedido": ["Build your order", "Arma tu pedido", "Composez votre commande", "Stelle deine Bestellung zusammen", "Crea il tuo ordine", "Stel je bestelling samen", "注文を組み立てる", "주문 구성하기", "搭配你的订单", "كوّن طلبك"],
  "Escolha seu estilo": ["Choose your style", "Elige tu estilo", "Choisissez votre style", "Wähle deinen Stil", "Scegli il tuo stile", "Kies je stijl", "スタイルを選ぶ", "스타일 선택", "选择你的风格", "اختر أسلوبك"],
  "Encontre seu time": ["Find your team", "Encuentra tu equipo", "Trouvez votre équipe", "Finde dein Team", "Trova la tua squadra", "Vind je team", "チームを見つける", "팀 찾기", "找到你的球队", "ابحث عن فريقك"],
  "Futebol brasileiro": ["Brazilian football", "Fútbol brasileño", "Football brésilien", "Brasilianischer Fußball", "Calcio brasiliano", "Braziliaans voetbal", "ブラジルサッカー", "브라질 축구", "巴西足球", "كرة القدم البرازيلية"],
  "Compre por liga": ["Shop by league", "Compra por liga", "Achetez par ligue", "Nach Liga shoppen", "Acquista per campionato", "Shop per competitie", "リーグから探す", "리그별 쇼핑", "按联赛选购", "تسوق حسب الدوري"],
  "Futebol internacional": ["International football", "Fútbol internacional", "Football international", "Internationaler Fußball", "Calcio internazionale", "Internationaal voetbal", "海外サッカー", "해외 축구", "国际足球", "كرة القدم العالمية"],
  "Perguntas frequentes": ["Frequently asked questions", "Preguntas frecuentes", "Questions fréquentes", "Häufig gestellte Fragen", "Domande frequenti", "Veelgestelde vragen", "よくある質問", "자주 묻는 질문", "常见问题", "الأسئلة الشائعة"],
  "Antes de comprar": ["Before you buy", "Antes de comprar", "Avant d’acheter", "Vor dem Kauf", "Prima di acquistare", "Voor je koopt", "購入前に", "구매 전 확인", "购买前须知", "قبل الشراء"],
  "NOVIDADES DROPBOX": ["DROPBOX NEWS", "NOVEDADES DROPBOX", "NOUVEAUTÉS DROPBOX", "DROPBOX-NEUHEITEN", "NOVITÀ DROPBOX", "DROPBOX-NIEUWS", "DROPBOX 新着", "DROPBOX 새소식", "DROPBOX 新品", "جديد DROPBOX"],

  // Product purchase flow.
  Tamanho: ["Size", "Talla", "Taille", "Größe", "Taglia", "Maat", "サイズ", "사이즈", "尺码", "المقاس"],
  "Ver guia de tamanhos": ["View size guide", "Ver guía de tallas", "Voir le guide des tailles", "Größentabelle ansehen", "Vedi guida alle taglie", "Maattabel bekijken", "サイズガイドを見る", "사이즈 가이드 보기", "查看尺码指南", "عرض دليل المقاسات"],
  "Guia de tamanhos": ["Size guide", "Guía de tallas", "Guide des tailles", "Größentabelle", "Guida alle taglie", "Maattabel", "サイズガイド", "사이즈 가이드", "尺码指南", "دليل المقاسات"],
  Personalizar: ["Customize", "Personalizar", "Personnaliser", "Personalisieren", "Personalizza", "Personaliseren", "カスタマイズ", "커스터마이즈", "个性化定制", "تخصيص"],
  Não: ["No", "No", "Non", "Nein", "No", "Nee", "いいえ", "아니요", "否", "لا"],
  Sim: ["Yes", "Sí", "Oui", "Ja", "Sì", "Ja", "はい", "예", "是", "نعم"],
  Nome: ["Name", "Nombre", "Nom", "Name", "Nome", "Naam", "名前", "이름", "姓名", "الاسم"],
  Número: ["Number", "Número", "Numéro", "Nummer", "Numero", "Nummer", "番号", "번호", "号码", "الرقم"],
  Patches: ["Patches", "Parches", "Écussons", "Patches", "Patch", "Patches", "パッチ", "패치", "臂章", "الشارات"],
  "Frase personalizada": ["Custom phrase", "Frase personalizada", "Phrase personnalisée", "Individueller Text", "Frase personalizzata", "Persoonlijke tekst", "カスタムフレーズ", "맞춤 문구", "自定义短语", "عبارة مخصصة"],
  "Você pode escolher mais de um. Cada patch custa": ["You can choose more than one. Each patch costs", "Puedes elegir más de uno. Cada parche cuesta", "Vous pouvez en choisir plusieurs. Chaque écusson coûte", "Du kannst mehrere auswählen. Jeder Patch kostet", "Puoi sceglierne più di uno. Ogni patch costa", "Je kunt er meerdere kiezen. Elke patch kost", "複数選択できます。各パッチの料金は", "여러 개를 선택할 수 있습니다. 패치당 가격은", "可选择多个。每个臂章价格为", "يمكنك اختيار أكثر من شارة. سعر كل شارة"],
  "Só mostramos patches compatíveis com este produto, competição e temporada.": ["Only patches compatible with this product, competition and season are shown.", "Solo mostramos parches compatibles con este producto, competición y temporada.", "Seuls les écussons compatibles avec ce produit, cette compétition et cette saison sont affichés.", "Es werden nur Patches angezeigt, die zu diesem Produkt, Wettbewerb und dieser Saison passen.", "Mostriamo solo patch compatibili con questo prodotto, competizione e stagione.", "We tonen alleen patches die bij dit product, deze competitie en dit seizoen passen.", "この商品・大会・シーズンに対応するパッチのみ表示しています。", "이 상품, 대회 및 시즌과 호환되는 패치만 표시됩니다.", "仅显示与该商品、赛事和赛季兼容的臂章。", "نعرض فقط الشارات المتوافقة مع هذا المنتج والبطولة والموسم."],
  Até: ["Up to", "Hasta", "Jusqu’à", "Bis zu", "Fino a", "Tot", "最大", "최대", "最多", "حتى"],
  caracteres: ["characters", "caracteres", "caractères", "Zeichen", "caratteri", "tekens", "文字", "자", "个字符", "حرفًا"],
  "sem números": ["no numbers", "sin números", "sans chiffres", "ohne Zahlen", "senza numeri", "zonder cijfers", "数字不可", "숫자 제외", "不可含数字", "بدون أرقام"],
  "Adicionais desta peça": ["Extras for this item", "Extras de esta prenda", "Options de cet article", "Extras für diesen Artikel", "Extra per questo articolo", "Extra's voor dit artikel", "この商品の追加オプション", "이 상품의 추가 옵션", "本商品附加项", "إضافات هذا المنتج"],
  "Prazo total estimado": ["Estimated total delivery time", "Plazo total estimado", "Délai total estimé", "Geschätzte Gesamtdauer", "Tempo totale stimato", "Geschatte totale levertijd", "合計お届け目安", "총 예상 소요 기간", "预计总时长", "المدة الإجمالية المقدرة"],
  "dias úteis": ["business days", "días hábiles", "jours ouvrés", "Werktage", "giorni lavorativi", "werkdagen", "営業日", "영업일", "个工作日", "أيام عمل"],
  "As medidas podem variar levemente entre modelos. O tamanho não altera o preço do produto.": ["Measurements may vary slightly between models. Size does not change the product price.", "Las medidas pueden variar ligeramente entre modelos. La talla no cambia el precio del producto.", "Les mesures peuvent varier légèrement selon les modèles. La taille ne change pas le prix du produit.", "Die Maße können je nach Modell leicht variieren. Die Größe ändert den Produktpreis nicht.", "Le misure possono variare leggermente tra i modelli. La taglia non modifica il prezzo del prodotto.", "Maten kunnen per model licht verschillen. De maat verandert de productprijs niet.", "モデルにより寸法が多少異なる場合があります。サイズによって商品価格は変わりません。", "모델에 따라 치수가 조금 다를 수 있습니다. 사이즈에 따라 상품 가격은 달라지지 않습니다.", "不同款式的尺寸可能略有差异。尺码不会改变商品价格。", "قد تختلف المقاسات قليلًا بين الموديلات. المقاس لا يغير سعر المنتج."],

  // Size guide.
  Torcedor: ["Fan", "Aficionado", "Supporter", "Fan", "Tifoso", "Fan", "ファン", "팬", "球迷版", "مشجع"],
  Jogador: ["Player", "Jugador", "Joueur", "Spieler", "Giocatore", "Speler", "選手", "선수", "球员版", "لاعب"],
  Feminina: ["Women", "Mujer", "Femme", "Damen", "Donna", "Dames", "レディース", "여성", "女款", "نسائي"],
  Infantil: ["Kids", "Infantil", "Enfant", "Kinder", "Bambini", "Kinderen", "キッズ", "키즈", "儿童", "أطفال"],
  Basquete: ["Basketball", "Baloncesto", "Basket", "Basketball", "Basket", "Basketbal", "バスケットボール", "농구", "篮球", "كرة السلة"],
  "Camisa Fan - Torcedor": ["Fan Shirt", "Camiseta de aficionado", "Maillot supporter", "Fan-Trikot", "Maglia tifoso", "Fanshirt", "ファン向けシャツ", "팬 셔츠", "球迷版球衣", "قميص المشجع"],
  "Camisa Player - Jogador": ["Player Shirt", "Camiseta de jugador", "Maillot joueur", "Spieler-Trikot", "Maglia giocatore", "Spelershirt", "選手向けシャツ", "선수용 셔츠", "球员版球衣", "قميص اللاعب"],
  "Camisa Feminina": ["Women's Shirt", "Camiseta de mujer", "Maillot femme", "Damen-Trikot", "Maglia donna", "Damesshirt", "レディースシャツ", "여성용 셔츠", "女款球衣", "قميص نسائي"],
  "Kit Infantil": ["Kids Kit", "Kit infantil", "Kit enfant", "Kinder-Set", "Kit bambini", "Kinderkit", "キッズキット", "키즈 키트", "儿童套装", "طقم أطفال"],
  "Regatas de Basquete - Silk": ["Basketball Jerseys - Silk", "Camisetas de baloncesto - Silk", "Maillots de basket - Silk", "Basketball-Trikots - Silk", "Canotte da basket - Silk", "Basketbalshirts - Silk", "バスケットボールジャージ - Silk", "농구 저지 - Silk", "篮球背心 - Silk", "قمصان كرة السلة - Silk"],
  Tam: ["Size", "Talla", "Taille", "Größe", "Taglia", "Maat", "サイズ", "사이즈", "尺码", "المقاس"],
  "Compr.": ["Length", "Largo", "Longueur", "Länge", "Lunghezza", "Lengte", "着丈", "총장", "衣长", "الطول"],
  Largura: ["Width", "Ancho", "Largeur", "Breite", "Larghezza", "Breedte", "身幅", "너비", "宽度", "العرض"],
  Altura: ["Height", "Altura", "Taille", "Körpergröße", "Altezza", "Lengte", "身長", "키", "身高", "الطول"],
  Peso: ["Weight", "Peso", "Poids", "Gewicht", "Peso", "Gewicht", "体重", "체중", "体重", "الوزن"],
  Idade: ["Age", "Edad", "Âge", "Alter", "Età", "Leeftijd", "年齢", "나이", "年龄", "العمر"],
  "Cintu.": ["Waist", "Cintura", "Taille", "Taille", "Vita", "Taille", "ウエスト", "허리", "腰围", "الخصر"],
  Busto: ["Chest", "Busto", "Poitrine", "Brust", "Torace", "Borst", "胸囲", "가슴", "胸围", "الصدر"],
  Ombros: ["Shoulders", "Hombros", "Épaules", "Schultern", "Spalle", "Schouders", "肩幅", "어깨", "肩宽", "الأكتاف"],
  "A tabela correspondente a este produto é selecionada automaticamente. Você também pode consultar as outras referências abaixo.": ["The table for this product is selected automatically. You can also check the other references below.", "La tabla correspondiente a este producto se selecciona automáticamente. También puedes consultar las demás referencias abajo.", "Le tableau correspondant à ce produit est sélectionné automatiquement. Vous pouvez aussi consulter les autres références ci-dessous.", "Die passende Tabelle für dieses Produkt wird automatisch ausgewählt. Unten kannst du auch die anderen Referenzen ansehen.", "La tabella relativa a questo prodotto viene selezionata automaticamente. Puoi consultare anche gli altri riferimenti qui sotto.", "De tabel voor dit product wordt automatisch geselecteerd. Je kunt hieronder ook de andere referenties bekijken.", "この商品に対応する表は自動的に選択されます。下のほかの参考表も確認できます。", "이 상품에 맞는 표가 자동으로 선택됩니다. 아래의 다른 기준표도 확인할 수 있습니다.", "系统会自动选择与该商品对应的尺码表。你也可以查看下方其他参考表。", "يتم اختيار الجدول المناسب لهذا المنتج تلقائيًا. ويمكنك أيضًا مراجعة الجداول الأخرى أدناه."],
  "Aviso:": ["Note:", "Aviso:", "Remarque :", "Hinweis:", "Nota:", "Let op:", "注意：", "안내:", "提示：", "تنبيه:"],
  "as medidas informadas são aproximadas e podem apresentar variação de até 2 a 3 cm, para mais ou para menos, conforme o molde utilizado.": ["the measurements are approximate and may vary by 2 to 3 cm, more or less, depending on the pattern used.", "las medidas son aproximadas y pueden variar entre 2 y 3 cm, más o menos, según el molde utilizado.", "les mesures sont approximatives et peuvent varier de 2 à 3 cm, en plus ou en moins, selon le patron utilisé.", "die Angaben sind Näherungswerte und können je nach Schnitt um etwa 2 bis 3 cm abweichen.", "le misure sono approssimative e possono variare di 2-3 cm, in più o in meno, in base al modello utilizzato.", "de maten zijn bij benadering en kunnen afhankelijk van het patroon 2 tot 3 cm afwijken.", "記載の寸法は目安で、型紙により前後2〜3cm程度の差が生じる場合があります。", "표기된 치수는 대략적인 값이며 패턴에 따라 약 2~3cm 차이가 날 수 있습니다.", "所列尺寸为近似值，根据版型不同可能有上下 2 至 3 厘米的误差。", "المقاسات المذكورة تقريبية وقد تختلف بنحو 2 إلى 3 سم زيادة أو نقصانًا حسب القالب المستخدم."],
  "Identificando a tabela deste produto...": ["Identifying this product's size table...", "Identificando la tabla de este producto...", "Identification du tableau de ce produit…", "Passende Tabelle wird ermittelt…", "Identificazione della tabella del prodotto...", "Maattabel voor dit product bepalen...", "この商品のサイズ表を確認しています…", "상품 사이즈표를 확인하는 중...", "正在识别该商品的尺码表…", "جارٍ تحديد جدول مقاسات هذا المنتج..."],
  "Este tipo de produto não possui uma tabela específica entre as referências fornecidas. As outras tabelas continuam disponíveis para consulta abaixo.": ["This product type does not have a specific table among the available references. The other tables remain available below.", "Este tipo de producto no tiene una tabla específica entre las referencias disponibles. Las demás tablas siguen disponibles abajo.", "Ce type de produit ne dispose pas d’un tableau spécifique parmi les références fournies. Les autres tableaux restent disponibles ci-dessous.", "Für diesen Produkttyp gibt es in den vorhandenen Referenzen keine eigene Tabelle. Die anderen Tabellen bleiben unten verfügbar.", "Per questo tipo di prodotto non è disponibile una tabella specifica tra i riferimenti forniti. Le altre tabelle restano consultabili qui sotto.", "Voor dit producttype is geen specifieke tabel beschikbaar. De andere tabellen blijven hieronder beschikbaar.", "この商品タイプ専用の表はありません。ほかの表は下から確認できます。", "이 상품 유형에 해당하는 전용 표가 없습니다. 다른 표는 아래에서 계속 확인할 수 있습니다.", "该商品类型没有专用尺码表。你仍可查看下方其他尺码表。", "لا يوجد جدول محدد لهذا النوع من المنتجات ضمن المراجع المتاحة. ويمكنك مراجعة الجداول الأخرى أدناه."],
  "Tabela recomendada para este produto": ["Recommended table for this product", "Tabla recomendada para este producto", "Tableau recommandé pour ce produit", "Empfohlene Tabelle für dieses Produkt", "Tabella consigliata per questo prodotto", "Aanbevolen tabel voor dit product", "この商品の推奨表", "이 상품의 권장 표", "该商品推荐尺码表", "الجدول الموصى به لهذا المنتج"],
  "Tabelas de medidas": ["Size charts", "Tablas de medidas", "Tableaux de mesures", "Maßtabellen", "Tabelle delle misure", "Maattabellen", "サイズ表", "사이즈표", "尺寸表", "جداول المقاسات"],
  "Como comparar": ["How to compare", "Cómo comparar", "Comment comparer", "So vergleichst du", "Come confrontare", "Hoe vergelijken", "比較方法", "비교 방법", "如何对比", "كيفية المقارنة"],
  "Use uma peça que já veste bem, estenda-a em uma superfície plana e compare as medidas com a tabela.": ["Use a garment that already fits well, lay it flat and compare its measurements with the chart.", "Usa una prenda que ya te quede bien, extiéndela sobre una superficie plana y compara las medidas con la tabla.", "Prenez un vêtement qui vous va déjà bien, posez-le à plat et comparez ses mesures au tableau.", "Nimm ein gut passendes Kleidungsstück, lege es flach hin und vergleiche die Maße mit der Tabelle.", "Usa un capo che ti veste bene, stendilo su una superficie piana e confronta le misure con la tabella.", "Gebruik een kledingstuk dat goed past, leg het plat neer en vergelijk de maten met de tabel.", "普段ちょうどよく着られる服を平らな場所に置き、サイズ表と寸法を比較してください。", "잘 맞는 옷을 평평한 곳에 펼친 뒤 치수를 표와 비교하세요.", "选择一件合身的衣物平铺，并将尺寸与表格进行对比。", "استخدم قطعة تناسبك جيدًا وافردها على سطح مستوٍ ثم قارن مقاساتها بالجدول."],
  Importante: ["Important", "Importante", "Important", "Wichtig", "Importante", "Belangrijk", "重要", "중요", "重要", "مهم"],
  "As faixas acima reproduzem as referências fornecidas. Em caso de dúvida entre dois tamanhos, considere o caimento que você prefere.": ["The ranges above reproduce the provided references. If you are between two sizes, consider the fit you prefer.", "Los rangos anteriores reproducen las referencias proporcionadas. Si dudas entre dos tallas, considera el ajuste que prefieres.", "Les plages ci-dessus reprennent les références fournies. Si vous hésitez entre deux tailles, choisissez selon la coupe que vous préférez.", "Die Bereiche oben entsprechen den bereitgestellten Referenzen. Wenn du zwischen zwei Größen liegst, wähle nach deiner bevorzugten Passform.", "Gli intervalli sopra riproducono i riferimenti forniti. Se sei indeciso tra due taglie, considera la vestibilità che preferisci.", "De bereiken hierboven volgen de opgegeven referenties. Twijfel je tussen twee maten, kies dan op basis van de pasvorm die je prettig vindt.", "上記の範囲は提供された参考値です。2サイズで迷う場合は、好みのフィット感で選んでください。", "위 범위는 제공된 기준을 반영합니다. 두 사이즈 사이에서 고민된다면 선호하는 핏을 기준으로 선택하세요.", "以上范围依据所提供的参考数据。若介于两个尺码之间，请根据你偏好的穿着效果选择。", "تعكس النطاقات أعلاه المراجع المقدمة. إذا كنت محتارًا بين مقاسين، فاختر وفق القَصّة التي تفضلها."],

  // Shipping.
  "Calcule a entrega": ["Calculate delivery", "Calcular entrega", "Calculer la livraison", "Lieferung berechnen", "Calcola la consegna", "Bezorging berekenen", "配送を計算", "배송비 계산", "计算配送", "احسب التوصيل"],
  "Consulte o valor e a previsão total para o seu CEP antes de adicionar ao carrinho.": ["Check the price and total delivery estimate for your postal code before adding to cart.", "Consulta el precio y el plazo total para tu código postal antes de añadir al carrito.", "Consultez le prix et le délai total pour votre code postal avant d’ajouter au panier.", "Prüfe Preis und gesamte Lieferzeit für deine Postleitzahl, bevor du den Artikel in den Warenkorb legst.", "Controlla il costo e la stima totale per il tuo CAP prima di aggiungere al carrello.", "Bekijk de prijs en totale bezorgindicatie voor je postcode voordat je iets aan de winkelwagen toevoegt.", "カートに追加する前に、郵便番号から送料と合計お届け目安を確認できます。", "장바구니에 담기 전에 우편번호로 배송비와 전체 예상 기간을 확인하세요.", "加入购物车前，请先根据邮编查看运费和预计总时长。", "تحقق من التكلفة والمدة الإجمالية المتوقعة لرمزك البريدي قبل الإضافة إلى السلة."],
  CEP: ["Postal code", "Código postal", "Code postal", "Postleitzahl", "CAP", "Postcode", "郵便番号", "우편번호", "邮编", "الرمز البريدي"],
  Calcular: ["Calculate", "Calcular", "Calculer", "Berechnen", "Calcola", "Berekenen", "計算する", "계산", "计算", "احسب"],
  "Informe um CEP válido com 8 dígitos.": ["Enter a valid 8-digit postal code.", "Introduce un código postal válido de 8 dígitos.", "Saisissez un code postal valide à 8 chiffres.", "Gib eine gültige 8-stellige Postleitzahl ein.", "Inserisci un CAP valido di 8 cifre.", "Voer een geldige postcode van 8 cijfers in.", "8桁の有効な郵便番号を入力してください。", "유효한 8자리 우편번호를 입력하세요.", "请输入有效的 8 位邮编。", "أدخل رمزًا بريديًا صالحًا مكونًا من 8 أرقام."],
  "Não foi possível calcular a entrega agora.": ["Delivery could not be calculated right now.", "No se pudo calcular la entrega en este momento.", "Impossible de calculer la livraison pour le moment.", "Die Lieferung kann derzeit nicht berechnet werden.", "Al momento non è possibile calcolare la consegna.", "De bezorging kan op dit moment niet worden berekend.", "現在、配送を計算できません。", "현재 배송을 계산할 수 없습니다.", "目前无法计算配送。", "تعذر حساب التوصيل الآن."],
  Transporte: ["Transit", "Transporte", "Transport", "Transport", "Trasporto", "Transport", "配送", "운송", "运输", "النقل"],
  "Previsão total": ["Total estimate", "Plazo total", "Estimation totale", "Gesamtschätzung", "Stima totale", "Totale schatting", "合計目安", "총 예상 기간", "总预计时长", "التقدير الإجمالي"],

  // Cart, checkout, auth and account common labels.
  Carrinho: ["Cart", "Carrito", "Panier", "Warenkorb", "Carrello", "Winkelwagen", "カート", "장바구니", "购物车", "السلة"],
  "Seu carrinho está vazio": ["Your cart is empty", "Tu carrito está vacío", "Votre panier est vide", "Dein Warenkorb ist leer", "Il tuo carrello è vuoto", "Je winkelwagen is leeg", "カートは空です", "장바구니가 비어 있습니다", "购物车为空", "سلتك فارغة"],
  "Continuar comprando": ["Continue shopping", "Seguir comprando", "Continuer les achats", "Weiter einkaufen", "Continua gli acquisti", "Verder winkelen", "買い物を続ける", "쇼핑 계속하기", "继续购物", "متابعة التسوق"],
  "Resumo do pedido": ["Order summary", "Resumen del pedido", "Récapitulatif de la commande", "Bestellübersicht", "Riepilogo ordine", "Besteloverzicht", "注文概要", "주문 요약", "订单摘要", "ملخص الطلب"],
  Subtotal: ["Subtotal", "Subtotal", "Sous-total", "Zwischensumme", "Subtotale", "Subtotaal", "小計", "소계", "小计", "المجموع الفرعي"],
  Desconto: ["Discount", "Descuento", "Réduction", "Rabatt", "Sconto", "Korting", "割引", "할인", "折扣", "الخصم"],
  Frete: ["Shipping", "Envío", "Livraison", "Versand", "Spedizione", "Verzending", "送料", "배송비", "运费", "الشحن"],
  Total: ["Total", "Total", "Total", "Gesamt", "Totale", "Totaal", "合計", "합계", "合计", "الإجمالي"],
  "Finalizar compra": ["Checkout", "Finalizar compra", "Passer la commande", "Zur Kasse", "Vai al checkout", "Afrekenen", "購入手続きへ", "결제하기", "去结算", "إتمام الشراء"],
  Quantidade: ["Quantity", "Cantidad", "Quantité", "Menge", "Quantità", "Aantal", "数量", "수량", "数量", "الكمية"],
  Remover: ["Remove", "Eliminar", "Supprimer", "Entfernen", "Rimuovi", "Verwijderen", "削除", "삭제", "移除", "إزالة"],
  Voltar: ["Back", "Volver", "Retour", "Zurück", "Indietro", "Terug", "戻る", "뒤로", "返回", "رجوع"],
  Continuar: ["Continue", "Continuar", "Continuer", "Weiter", "Continua", "Doorgaan", "続ける", "계속", "继续", "متابعة"],
  "Seus dados": ["Your details", "Tus datos", "Vos informations", "Deine Daten", "I tuoi dati", "Je gegevens", "お客様情報", "고객 정보", "你的信息", "بياناتك"],
  Endereço: ["Address", "Dirección", "Adresse", "Adresse", "Indirizzo", "Adres", "住所", "주소", "地址", "العنوان"],
  Entrega: ["Delivery", "Entrega", "Livraison", "Lieferung", "Consegna", "Bezorging", "配送", "배송", "配送", "التوصيل"],
  Pagamento: ["Payment", "Pago", "Paiement", "Zahlung", "Pagamento", "Betaling", "支払い", "결제", "支付", "الدفع"],
  "Confirmar pedido": ["Confirm order", "Confirmar pedido", "Confirmer la commande", "Bestellung bestätigen", "Conferma ordine", "Bestelling bevestigen", "注文を確定", "주문 확인", "确认订单", "تأكيد الطلب"],
  "Finalizar pedido": ["Place order", "Finalizar pedido", "Finaliser la commande", "Bestellung abschließen", "Completa ordine", "Bestelling afronden", "注文を完了", "주문 완료", "提交订单", "إتمام الطلب"],
  "Pedido realizado": ["Order placed", "Pedido realizado", "Commande passée", "Bestellung aufgegeben", "Ordine effettuato", "Bestelling geplaatst", "注文が完了しました", "주문이 완료되었습니다", "订单已提交", "تم تقديم الطلب"],
  Cupom: ["Coupon", "Cupón", "Code promo", "Gutschein", "Coupon", "Kortingscode", "クーポン", "쿠폰", "优惠券", "قسيمة"],
  Aplicar: ["Apply", "Aplicar", "Appliquer", "Anwenden", "Applica", "Toepassen", "適用", "적용", "应用", "تطبيق"],
  Entrar: ["Sign in", "Entrar", "Se connecter", "Anmelden", "Accedi", "Inloggen", "ログイン", "로그인", "登录", "تسجيل الدخول"],
  "Criar conta": ["Create account", "Crear cuenta", "Créer un compte", "Konto erstellen", "Crea account", "Account aanmaken", "アカウント作成", "계정 만들기", "创建账户", "إنشاء حساب"],
  "E-mail": ["Email", "Correo electrónico", "E-mail", "E-Mail", "E-mail", "E-mail", "メール", "이메일", "电子邮箱", "البريد الإلكتروني"],
  Senha: ["Password", "Contraseña", "Mot de passe", "Passwort", "Password", "Wachtwoord", "パスワード", "비밀번호", "密码", "كلمة المرور"],
  "Confirmar senha": ["Confirm password", "Confirmar contraseña", "Confirmer le mot de passe", "Passwort bestätigen", "Conferma password", "Wachtwoord bevestigen", "パスワードを確認", "비밀번호 확인", "确认密码", "تأكيد كلمة المرور"],
  "Esqueci minha senha": ["Forgot password", "Olvidé mi contraseña", "Mot de passe oublié", "Passwort vergessen", "Password dimenticata", "Wachtwoord vergeten", "パスワードを忘れた", "비밀번호 찾기", "忘记密码", "نسيت كلمة المرور"],
  "Recuperar senha": ["Reset password", "Recuperar contraseña", "Réinitialiser le mot de passe", "Passwort zurücksetzen", "Reimposta password", "Wachtwoord herstellen", "パスワードを再設定", "비밀번호 재설정", "重置密码", "إعادة تعيين كلمة المرور"],
  "Nome completo": ["Full name", "Nombre completo", "Nom complet", "Vollständiger Name", "Nome completo", "Volledige naam", "氏名", "이름", "姓名", "الاسم الكامل"],
  Telefone: ["Phone", "Teléfono", "Téléphone", "Telefon", "Telefono", "Telefoon", "電話番号", "전화번호", "电话", "الهاتف"],
  Cadastrar: ["Sign up", "Registrarse", "S’inscrire", "Registrieren", "Registrati", "Registreren", "登録", "가입", "注册", "تسجيل"],
  Sair: ["Sign out", "Salir", "Se déconnecter", "Abmelden", "Esci", "Uitloggen", "ログアウト", "로그아웃", "退出登录", "تسجيل الخروج"],
  "Minha conta": ["My account", "Mi cuenta", "Mon compte", "Mein Konto", "Il mio account", "Mijn account", "マイアカウント", "내 계정", "我的账户", "حسابي"],
  "Meus pedidos": ["My orders", "Mis pedidos", "Mes commandes", "Meine Bestellungen", "I miei ordini", "Mijn bestellingen", "注文履歴", "내 주문", "我的订单", "طلباتي"],
  "Dados pessoais": ["Personal details", "Datos personales", "Informations personnelles", "Persönliche Daten", "Dati personali", "Persoonlijke gegevens", "個人情報", "개인 정보", "个人信息", "البيانات الشخصية"],
  Endereços: ["Addresses", "Direcciones", "Adresses", "Adressen", "Indirizzi", "Adressen", "住所", "주소", "地址", "العناوين"],
  Segurança: ["Security", "Seguridad", "Sécurité", "Sicherheit", "Sicurezza", "Beveiliging", "セキュリティ", "보안", "安全", "الأمان"],
  Afiliados: ["Affiliates", "Afiliados", "Affiliés", "Partner", "Affiliati", "Affiliates", "アフィリエイト", "제휴", "联盟", "الشركاء"],
  Pedidos: ["Orders", "Pedidos", "Commandes", "Bestellungen", "Ordini", "Bestellingen", "注文", "주문", "订单", "الطلبات"],

  // Footer, institutional and privacy basics.
  "PEDIDO ACOMPANHADO": ["ORDER TRACKING", "PEDIDO RASTREADO", "SUIVI DE COMMANDE", "BESTELLVERFOLGUNG", "ORDINE TRACCIATO", "BESTELLING VOLGEN", "注文追跡", "주문 추적", "订单跟踪", "تتبع الطلب"],
  "Status e histórico na sua conta.": ["Status and history in your account.", "Estado e historial en tu cuenta.", "Statut et historique dans votre compte.", "Status und Verlauf in deinem Konto.", "Stato e cronologia nel tuo account.", "Status en geschiedenis in je account.", "アカウントで状況と履歴を確認できます。", "계정에서 상태와 내역을 확인하세요.", "可在账户中查看状态和历史记录。", "الحالة والسجل في حسابك."],
  "PAGAMENTO ONLINE": ["ONLINE PAYMENT", "PAGO ONLINE", "PAIEMENT EN LIGNE", "ONLINE-ZAHLUNG", "PAGAMENTO ONLINE", "ONLINE BETALEN", "オンライン決済", "온라인 결제", "在线支付", "الدفع عبر الإنترنت"],
  "Pix e cartões no checkout.": ["Pix and cards at checkout.", "Pix y tarjetas al finalizar la compra.", "Pix et cartes lors du paiement.", "Pix und Karten an der Kasse.", "Pix e carte al checkout.", "Pix en kaarten bij het afrekenen.", "チェックアウトでPixとカードが利用できます。", "결제 시 Pix와 카드를 사용할 수 있습니다.", "结账时可使用 Pix 和银行卡。", "Pix والبطاقات عند الدفع."],
  ATENDIMENTO: ["SUPPORT", "ATENCIÓN", "ASSISTANCE", "SUPPORT", "ASSISTENZA", "KLANTENSERVICE", "サポート", "고객지원", "客服", "الدعم"],
  "Suporte pelos canais oficiais.": ["Support through official channels.", "Soporte por los canales oficiales.", "Assistance via les canaux officiels.", "Support über die offiziellen Kanäle.", "Assistenza tramite i canali ufficiali.", "Support via de officiële kanalen.", "公式チャネルでサポートします。", "공식 채널을 통해 지원합니다.", "通过官方渠道提供支持。", "الدعم عبر القنوات الرسمية."],
  "Camisas e artigos esportivos com compra online e atendimento pelos canais oficiais.": ["Football shirts and sporting goods with online shopping and support through official channels.", "Camisetas y artículos deportivos con compra online y atención por canales oficiales.", "Maillots et articles de sport avec achat en ligne et assistance via les canaux officiels.", "Trikots und Sportartikel mit Online-Kauf und Support über offizielle Kanäle.", "Maglie e articoli sportivi con acquisto online e assistenza tramite i canali ufficiali.", "Voetbalshirts en sportartikelen met online aankoop en ondersteuning via officiële kanalen.", "ユニフォームやスポーツ用品をオンラインで購入でき、公式チャネルでサポートします。", "유니폼과 스포츠 용품을 온라인으로 구매하고 공식 채널에서 지원받을 수 있습니다.", "可在线购买球衣和体育用品，并通过官方渠道获得支持。", "قمصان ومنتجات رياضية للشراء عبر الإنترنت مع دعم عبر القنوات الرسمية."],
  "Fale por e-mail": ["Contact us by email", "Contacta por correo", "Contactez-nous par e-mail", "Per E-Mail kontaktieren", "Contattaci via e-mail", "Neem contact op via e-mail", "メールで問い合わせ", "이메일 문의", "邮件联系我们", "تواصل عبر البريد الإلكتروني"],
  "Acesso rápido": ["Quick links", "Acceso rápido", "Accès rapide", "Schnellzugriff", "Accesso rapido", "Snelkoppelingen", "クイックリンク", "빠른 링크", "快速链接", "روابط سريعة"],
  Início: ["Home", "Inicio", "Accueil", "Startseite", "Home", "Home", "ホーム", "홈", "首页", "الرئيسية"],
  Produtos: ["Products", "Productos", "Produits", "Produkte", "Prodotti", "Producten", "商品", "상품", "商品", "المنتجات"],
  "Painel administrativo": ["Admin dashboard", "Panel administrativo", "Tableau d’administration", "Admin-Dashboard", "Pannello amministratore", "Beheerderspaneel", "管理パネル", "관리자 패널", "管理面板", "لوحة الإدارة"],
  "Ajuda e políticas": ["Help & policies", "Ayuda y políticas", "Aide et politiques", "Hilfe & Richtlinien", "Aiuto e politiche", "Hulp & beleid", "ヘルプとポリシー", "도움말 및 정책", "帮助与政策", "المساعدة والسياسات"],
  "Trocas e devoluções": ["Exchanges & returns", "Cambios y devoluciones", "Échanges et retours", "Umtausch & Rückgabe", "Cambi e resi", "Ruilen & retourneren", "交換・返品", "교환 및 반품", "换货与退货", "الاستبدال والإرجاع"],
  "Produção e envio": ["Production & shipping", "Producción y envío", "Production et expédition", "Produktion & Versand", "Produzione e spedizione", "Productie & verzending", "製作・発送", "제작 및 배송", "生产与配送", "الإنتاج والشحن"],
  Privacidade: ["Privacy", "Privacidad", "Confidentialité", "Datenschutz", "Privacy", "Privacy", "プライバシー", "개인정보", "隐私", "الخصوصية"],
  "Preferências de cookies": ["Cookie preferences", "Preferencias de cookies", "Préférences des cookies", "Cookie-Einstellungen", "Preferenze cookie", "Cookievoorkeuren", "Cookie設定", "쿠키 설정", "Cookie 偏好", "تفضيلات ملفات تعريف الارتباط"],
  "Termos de compra": ["Purchase terms", "Términos de compra", "Conditions d’achat", "Kaufbedingungen", "Termini di acquisto", "Aankoopvoorwaarden", "購入規約", "구매 약관", "购买条款", "شروط الشراء"],
  Contato: ["Contact", "Contacto", "Contact", "Kontakt", "Contatti", "Contact", "お問い合わせ", "문의", "联系我们", "اتصل بنا"],
  "Formas de pagamento": ["Payment methods", "Formas de pago", "Moyens de paiement", "Zahlungsarten", "Metodi di pagamento", "Betaalmethoden", "支払い方法", "결제 수단", "支付方式", "طرق الدفع"],
  "Pix e principais cartões no pagamento online.": ["Pix and major cards for online payment.", "Pix y principales tarjetas para el pago online.", "Pix et principales cartes pour le paiement en ligne.", "Pix und gängige Karten für Online-Zahlungen.", "Pix e principali carte per il pagamento online.", "Pix en de belangrijkste kaarten voor online betaling.", "オンライン決済でPixと主要カードが利用できます。", "온라인 결제에서 Pix와 주요 카드를 사용할 수 있습니다.", "在线支付支持 Pix 和主流银行卡。", "Pix وأهم البطاقات للدفع عبر الإنترنت."],
  "Todos os direitos reservados.": ["All rights reserved.", "Todos los derechos reservados.", "Tous droits réservés.", "Alle Rechte vorbehalten.", "Tutti i diritti riservati.", "Alle rechten voorbehouden.", "無断転載を禁じます。", "모든 권리 보유.", "版权所有。", "جميع الحقوق محفوظة."],
  "Precisa de ajuda? Fale conosco.": ["Need help? Contact us.", "¿Necesitas ayuda? Contáctanos.", "Besoin d’aide ? Contactez-nous.", "Brauchst du Hilfe? Kontaktiere uns.", "Hai bisogno di aiuto? Contattaci.", "Hulp nodig? Neem contact op.", "お困りですか？お問い合わせください。", "도움이 필요하신가요? 문의하세요.", "需要帮助？联系我们。", "هل تحتاج إلى مساعدة؟ تواصل معنا."],
  Cookies: ["Cookies", "Cookies", "Cookies", "Cookies", "Cookie", "Cookies", "Cookie", "쿠키", "Cookie", "ملفات تعريف الارتباط"],
  "Aceitar todos": ["Accept all", "Aceptar todo", "Tout accepter", "Alle akzeptieren", "Accetta tutto", "Alles accepteren", "すべて許可", "모두 허용", "全部接受", "قبول الكل"],
  "Rejeitar opcionais": ["Reject optional", "Rechazar opcionales", "Refuser les facultatifs", "Optionale ablehnen", "Rifiuta opzionali", "Optionele weigeren", "任意項目を拒否", "선택 항목 거부", "拒绝可选项", "رفض الاختيارية"],
  "Salvar preferências": ["Save preferences", "Guardar preferencias", "Enregistrer les préférences", "Einstellungen speichern", "Salva preferenze", "Voorkeuren opslaan", "設定を保存", "설정 저장", "保存偏好", "حفظ التفضيلات"],
  Necessários: ["Necessary", "Necesarios", "Nécessaires", "Notwendig", "Necessari", "Noodzakelijk", "必須", "필수", "必要", "ضرورية"],
  Preferências: ["Preferences", "Preferencias", "Préférences", "Präferenzen", "Preferenze", "Voorkeuren", "設定", "환경설정", "偏好", "التفضيلات"],
  Análise: ["Analytics", "Análisis", "Analyse", "Analyse", "Analisi", "Analyse", "分析", "분석", "分析", "التحليلات"],
  Marketing: ["Marketing", "Marketing", "Marketing", "Marketing", "Marketing", "Marketing", "マーケティング", "마케팅", "营销", "التسويق"],

  // Administration / finance common labels.
  Administração: ["Administration", "Administración", "Administration", "Verwaltung", "Amministrazione", "Beheer", "管理", "관리", "管理", "الإدارة"],
  "Administração financeira": ["Financial administration", "Administración financiera", "Administration financière", "Finanzverwaltung", "Amministrazione finanziaria", "Financieel beheer", "財務管理", "재무 관리", "财务管理", "الإدارة المالية"],
  Financeiro: ["Finance", "Finanzas", "Finances", "Finanzen", "Finanze", "Financiën", "財務", "재무", "财务", "المالية"],
  Receita: ["Revenue", "Ingresos", "Chiffre d’affaires", "Umsatz", "Ricavi", "Omzet", "売上", "매출", "收入", "الإيرادات"],
  Custos: ["Costs", "Costos", "Coûts", "Kosten", "Costi", "Kosten", "コスト", "비용", "成本", "التكاليف"],
  Lucro: ["Profit", "Beneficio", "Bénéfice", "Gewinn", "Profitto", "Winst", "利益", "이익", "利润", "الربح"],
  Margem: ["Margin", "Margen", "Marge", "Marge", "Margine", "Marge", "利益率", "마진", "利润率", "الهامش"],
  Clientes: ["Customers", "Clientes", "Clients", "Kunden", "Clienti", "Klanten", "顧客", "고객", "客户", "العملاء"],
  Saldo: ["Balance", "Saldo", "Solde", "Saldo", "Saldo", "Saldo", "残高", "잔액", "余额", "الرصيد"],
};

function localeIndex(locale: Locale) {
  return NON_PT_LOCALES.indexOf(locale as NonPtLocale);
}

export function siteCopy(locale: Locale, source: string) {
  if (locale === "pt") return source;
  const row = COPY[source];
  if (!row) return source;
  const index = localeIndex(locale);
  return index >= 0 ? row[index] : source;
}

export function hasSiteCopy(source: string) {
  return Boolean(COPY[source]);
}

export const SITE_COPY_SOURCES = Object.freeze(Object.keys(COPY));

export function formatBusinessDays(locale: Locale, min: number, max = min) {
  if (locale === "pt") return min === max ? `${max} dias úteis` : `${min} a ${max} dias úteis`;
  const unit = siteCopy(locale, "dias úteis");
  if (locale === "ja") return min === max ? `${max}${unit}` : `${min}〜${max}${unit}`;
  if (locale === "ko") return min === max ? `${max}${unit}` : `${min}~${max}${unit}`;
  if (locale === "zh") return min === max ? `${max}${unit}` : `${min} 至 ${max}${unit}`;
  if (locale === "ar") return min === max ? `${max} ${unit}` : `${min} إلى ${max} ${unit}`;
  if (locale === "es") return min === max ? `${max} ${unit}` : `${min} a ${max} ${unit}`;
  if (locale === "fr") return min === max ? `${max} ${unit}` : `${min} à ${max} ${unit}`;
  if (locale === "de") return min === max ? `${max} ${unit}` : `${min} bis ${max} ${unit}`;
  if (locale === "it") return min === max ? `${max} ${unit}` : `${min}–${max} ${unit}`;
  if (locale === "nl") return min === max ? `${max} ${unit}` : `${min} tot ${max} ${unit}`;
  return min === max ? `${max} ${unit}` : `${min}–${max} ${unit}`;
}

export function formatPersonalizationOption(locale: Locale, kind: "nameNumber" | "phrase", price: string) {
  const base: Record<Locale, Record<typeof kind, string>> = {
    pt: { nameNumber: `Sim — nome e número (+${price})`, phrase: `Sim — frase (+${price})` },
    en: { nameNumber: `Yes — name and number (+${price})`, phrase: `Yes — phrase (+${price})` },
    es: { nameNumber: `Sí — nombre y número (+${price})`, phrase: `Sí — frase (+${price})` },
    fr: { nameNumber: `Oui — nom et numéro (+${price})`, phrase: `Oui — phrase (+${price})` },
    de: { nameNumber: `Ja — Name und Nummer (+${price})`, phrase: `Ja — Text (+${price})` },
    it: { nameNumber: `Sì — nome e numero (+${price})`, phrase: `Sì — frase (+${price})` },
    nl: { nameNumber: `Ja — naam en nummer (+${price})`, phrase: `Ja — tekst (+${price})` },
    ja: { nameNumber: `はい — 名前と番号 (+${price})`, phrase: `はい — フレーズ (+${price})` },
    ko: { nameNumber: `예 — 이름과 번호 (+${price})`, phrase: `예 — 문구 (+${price})` },
    zh: { nameNumber: `是 — 姓名和号码 (+${price})`, phrase: `是 — 短语 (+${price})` },
    ar: { nameNumber: `نعم — الاسم والرقم (+${price})`, phrase: `نعم — عبارة (+${price})` },
  };
  return base[locale][kind];
}

export function formatLeadTimeDetail(locale: Locale, productionDays: number, deliveryMin: number, deliveryMax: number) {
  const production = formatBusinessDays(locale, productionDays);
  const delivery = formatBusinessDays(locale, deliveryMin, deliveryMax);
  const text: Record<Locale, string> = {
    pt: `Inclui até ${production} de preparação e ${delivery} de transporte. O prazo pode variar conforme a localidade.`,
    en: `Includes up to ${production} for preparation and ${delivery} for transit. Timing may vary by location.`,
    es: `Incluye hasta ${production} de preparación y ${delivery} de transporte. El plazo puede variar según la localidad.`,
    fr: `Comprend jusqu’à ${production} de préparation et ${delivery} de transport. Le délai peut varier selon la destination.`,
    de: `Enthält bis zu ${production} Vorbereitung und ${delivery} Transport. Die Dauer kann je nach Ort variieren.`,
    it: `Include fino a ${production} di preparazione e ${delivery} di trasporto. I tempi possono variare in base alla località.`,
    nl: `Inclusief maximaal ${production} voorbereiding en ${delivery} transport. De termijn kan per locatie verschillen.`,
    ja: `準備に最大${production}、配送に${delivery}を含みます。地域により期間が変わる場合があります。`,
    ko: `준비에 최대 ${production}, 배송에 ${delivery}이 포함됩니다. 지역에 따라 기간이 달라질 수 있습니다.`,
    zh: `包含最多 ${production} 的备货时间和 ${delivery} 的运输时间。实际时长可能因地区而异。`,
    ar: `يشمل ما يصل إلى ${production} للتجهيز و${delivery} للنقل. قد تختلف المدة حسب الموقع.`,
  };
  return text[locale];
}

export function formatRecommendedSizeTable(locale: Locale, title: string) {
  const prefix = siteCopy(locale, "Tabela recomendada para este produto");
  return `${prefix}: ${title}.`;
}

export function formatShippingTotalNote(locale: Locale, productionDays: number) {
  const preparation = formatBusinessDays(locale, productionDays);
  const text: Record<Locale, string> = {
    pt: `A previsão total soma até ${preparation} de preparação ao prazo de transporte informado para o CEP.`,
    en: `The total estimate adds up to ${preparation} of preparation to the transit time shown for the postal code.`,
    es: `La estimación total suma hasta ${preparation} de preparación al plazo de transporte indicado para el código postal.`,
    fr: `L’estimation totale ajoute jusqu’à ${preparation} de préparation au délai de transport indiqué pour le code postal.`,
    de: `Zur Gesamtschätzung kommen bis zu ${preparation} Vorbereitung zur angegebenen Transportzeit für die Postleitzahl hinzu.`,
    it: `La stima totale aggiunge fino a ${preparation} di preparazione al tempo di trasporto indicato per il CAP.`,
    nl: `De totale schatting telt maximaal ${preparation} voorbereiding op bij de transporttijd voor de postcode.`,
    ja: `合計目安には、郵便番号に表示された配送期間に最大${preparation}の準備期間が加算されます。`,
    ko: `총 예상 기간에는 우편번호에 표시된 배송 기간에 최대 ${preparation}의 준비 기간이 더해집니다.`,
    zh: `总预计时长会在该邮编显示的运输时间基础上，加上最多 ${preparation} 的备货时间。`,
    ar: `يضيف التقدير الإجمالي ما يصل إلى ${preparation} للتجهيز إلى مدة النقل المعروضة للرمز البريدي.`,
  };
  return text[locale];
}
