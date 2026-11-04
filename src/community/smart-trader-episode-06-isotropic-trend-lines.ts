/**
 * Smart Trader, Episode 06, Isotropic Trend Lines
 *
 * Trend channels in an "isotropic" coordinate space: y = ln(price) / sigma, with sigma the Yang-Zhang volatility of
 * the last `Yang-Zhang Sigma Length` bars (overnight variance + k x open-to-close variance + (1 - k) x Rogers-Satchell
 * mean, k = 0.34 / (1.34 + (n + 1) / (n - 1))).
 * - Blocks: the history is cut into `Trend Block Groups` blocks of `Trend Block Period` bars, from the anchor bar (the
 *   current bar with "Live Bar", the bar before with "Close Bar"). Each block gives its highest high, lowest low,
 *   geometric mean exp((ln(high) + ln(low)) / 2) and centre bar.
 * - Direction: sign of the newest pair of block means; the segment grows while older pairs move the same way. The
 *   angle is the arctan of the slope (in sigma per bar) between the means of the oldest and newest segment blocks;
 *   at or below `Range Threshold (°)` it is a range.
 * - Channel: upper line through the highest and lowest block highs, lower line through the highest and lowest block
 *   lows (log-linear), horizontal at the extremes in a range.
 * - The same analysis runs on fixed periods 3, 7, 13, 19, 29 and 47 for the consensus row of the dashboard.
 * - A breakout / retest state machine on the primary channel (inside, breakout up / down, retest up / down, with a
 *   1-sigma distance rule) gives the narrative row of the dashboard and alerts.
 * Drawn on the last bar (and on the last closed bar before it): channel lines with a dotted projection, linefills,
 * diamond labels at the anchor bar, an optional direction / angle label, optional block boxes and an optional angle
 * line, the dashboard table; a warning label when alerts are on with "Close Bar". Hidden plots: Angle, Agreement,
 * ChannelPos (display none, as the original).
 *
 * Chart context: `syminfo.mintick` (price texts), `syminfo.ticker`, `syminfo.currency`, `timeframe.period`,
 * `chart.bg_color` / `chart.fg_color` (label and table colours; without a context the dark theme colours) and the
 * state of the last bar (the drawing block runs on the last closed bar and on the last bar).
 *
 * Reference: "Smart Trader, Episode 06, Isotropic Trend Lines" by ata_sabanci
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, str, math, color, line, label, box, linefill, table, timeframe, Series, resetDrawings, setDrawingBar,
  drawingOutputs, varDrawing,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type Line, type Label, type Box, type Linefill,
  type Table, type LineStyle, type TablePosition,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import {
  mintickOf, tickerOf, currencyOf, foregroundColorOf, backgroundColorOf, lastBarConfirmedOf, type ChartContext,
} from '../chart-context';
import { chartTimeframe } from '../anchor-period';
import { alertStates, type AlertConditionDecl, type AlertConditionState } from '../alert-states';

type Lang = 'English' | 'Türkçe' | 'العربية' | 'Русский' | 'Italiano' | 'Português (BR)' | '中文';
type StyleName = 'Solid' | 'Dashed' | 'Dotted';
type DashPos = 'Top Left' | 'Top Center' | 'Top Right' | 'Middle Left' | 'Middle Center' | 'Middle Right'
  | 'Bottom Left' | 'Bottom Center' | 'Bottom Right';

// ── Language tables and input tooltips (texts of the original) ──
/** Every text of the dashboard, labels and tooltips, per language (fields of the original's I18n type) */
interface I18n {
  lbl_period: string;
  lbl_trend: string;
  lbl_agreement: string;
  dir_up: string;
  dir_dn: string;
  dir_rng: string;
  st_bo_up: string;
  st_bo_dn: string;
  st_rt_up_broke_at: string;
  st_rt_dn_broke_at: string;
  st_inside: string;
  st_inside_dir_ch: string;
  st_inside_fail_up: string;
  st_inside_fail_dn: string;
  conn_at: string;
  conn_gap: string;
  conn_retested: string;
  conn_now: string;
  dist_above_ceiling: string;
  dist_below_floor: string;
  dist_from_floor: string;
  dist_to_ceiling: string;
  tip_header: string;
  tip_period: string;
  tip_trend: string;
  tip_agreement: string;
  tip_narrative: string;
  lbl_close: string;
  lbl_ceiling: string;
  lbl_floor: string;
  lbl_ext: string;
  lbl_trend_tip: string;
  lbl_angle: string;
  lbl_blocks: string;
  alert_warn: string;
  alert_warn_tip: string;
}

const I18N_EN: I18n = {
  lbl_period: "period",
  lbl_trend: "trend",
  lbl_agreement: "agreement",
  dir_up: "UP",
  dir_dn: "DN",
  dir_rng: "RNG",
  st_bo_up: "Breakout Up",
  st_bo_dn: "Breakout Down",
  st_rt_up_broke_at: "Retest Up · broke at",
  st_rt_dn_broke_at: "Retest Down · broke at",
  st_inside: "Inside channel",
  st_inside_dir_ch: "Inside · direction changed",
  st_inside_fail_up: "Inside · failed breakout up",
  st_inside_fail_dn: "Inside · failed breakout down",
  conn_at: "at",
  conn_gap: "(gap)",
  conn_retested: "· retested",
  conn_now: "now",
  dist_above_ceiling: "% above ceiling",
  dist_below_floor: "% below floor",
  dist_from_floor: "% from floor",
  dist_to_ceiling: "% to ceiling",
  tip_header: "ST-EP06 — Smart Trader, Episode 06: Isotropic Trend Lines.\n\nMulti-scale trend channels in σ-normalized coordinate space (ICS). Header price is always live close (Live Exception). All other values anchor at the bar chosen via Calculation Bar — [0] in Live Bar mode, [1] in Close Bar mode.",
  tip_period: "Block periods for the 6-scale parallel analysis.\n\nEach scale partitions history into blocks and reduces each to a log-midpoint geometric mean.\n\nThe '19' column = primary engine (uses your Period input). Others use fixed periods for cross-scale consensus.",
  tip_trend: "Per-scale trend direction from the longest monotonic segment of block geometric means.\n\n▲ UP · ▼ DN · ◈ RNG\n\nRNG = absolute ICS angle within ±Range Threshold. Angle is arctan of σ-normalized slope, comparable across markets.",
  tip_agreement: "Cross-scale consensus.\n\nHow many of the 6 scales agree on direction, shown with the primary channel Ch▲ (ceiling) and Ch▼ (floor).\n\n5/6 or 6/6 = structural trend visible at every temporal resolution.",
  tip_narrative: "Breakout / Retest narrative (primary engine, scale 19).\n\nOne-line state + distance summary:\n\n• Inside — % from floor · % to ceiling (sums to 100%)\n• Breakout Up/Down — price exited channel, shown with breakout price and % beyond the boundary\n• Retest — after moving ≥1σ from the boundary, price returned to test it\n\n✓ = confirmed (retested and bounced ≥1σ).\n(gap) = price crossed the entire channel in one move.\n\nAll distances are % of channel width (scale-invariant). σ thresholds are dynamic (Yang-Zhang).",
  lbl_close: "Close",
  lbl_ceiling: "Ceiling",
  lbl_floor: "Floor",
  lbl_ext: "Extension",
  lbl_trend_tip: "Trend",
  lbl_angle: "Angle",
  lbl_blocks: "Blocks",
  alert_warn: "Alerts require Calculation Bar = Live Bar",
  alert_warn_tip: "Alerts are currently enabled but Calculation Bar is set to Close Bar.\n\nClose Bar mode anchors computations at the last closed bar, which is semantically incompatible with live alerts. To fire alerts without lag, open indicator settings and change Calculation Bar to Live Bar.\n\nUntil then, all alertconditions are suppressed.",
};

const I18N: Record<Lang, I18n> = {
  English: I18N_EN,
  "Türkçe": {
    lbl_period: "Periyot",
    lbl_trend: "Trend",
    lbl_agreement: "Uyum",
    dir_up: "YÜK",
    dir_dn: "DÜŞ",
    dir_rng: "YTY",
    st_bo_up: "Yukarı Kırılım",
    st_bo_dn: "Aşağı Kırılım",
    st_rt_up_broke_at: "Yukarı retest · kırılım",
    st_rt_dn_broke_at: "Aşağı retest · kırılım",
    st_inside: "Kanal içinde",
    st_inside_dir_ch: "Kanal içinde · yön değişti",
    st_inside_fail_up: "Kanal içinde · başarısız yukarı kırılım",
    st_inside_fail_dn: "Kanal içinde · başarısız aşağı kırılım",
    conn_at: "@",
    conn_gap: "(sıçrama)",
    conn_retested: "· yeniden test",
    conn_now: "şimdi",
    dist_above_ceiling: "% tavan üstü",
    dist_below_floor: "% taban altı",
    dist_from_floor: "% tabandan",
    dist_to_ceiling: "% tavana",
    tip_header: "ST-EP06 — Smart Trader, 6. Bölüm: İzotropik Trend Çizgileri.\n\nσ ile normalize edilmiş koordinat uzayında (ICS) çoklu ölçek trend kanalları. Başlık fiyatı her zaman canlı kapanıştır (Live Exception). Diğer tüm değerler Calculation Bar ile seçilen bara sabitlenir — Live Bar modunda [0], Close Bar modunda [1].",
    tip_period: "6 ölçekli paralel analiz için blok periyotları.\n\nHer ölçek geçmişi bloklara böler ve her bloğu log-orta nokta geometrik ortalamasına indirir.\n\n'19' sütunu = birincil motor (Periyot girdinizi kullanır). Diğerleri ölçekler arası uzlaşı için sabit periyotlar kullanır.",
    tip_trend: "Blok geometrik ortalamalarının en uzun monoton segmentinden ölçek başına trend yönü.\n\n▲ YÜK · ▼ DÜŞ · ◈ YTY\n\nYTY = ±Aralık Eşiği içinde mutlak ICS açısı. Açı, σ-normalize eğimin arctan'ıdır ve piyasalar arasında karşılaştırılabilirdir.",
    tip_agreement: "Ölçekler arası uzlaşı.\n\n6 ölçekten kaçının yön üzerinde anlaştığı, birincil kanal ▲ (tavan) ve ▼ (taban) ile gösterilir.\n\n5/6 veya 6/6 = her zaman çözünürlüğünde görünen yapısal trend.",
    tip_narrative: "Kırılım / Retest anlatımı (birincil motor, ölçek 19).\n\nTek satırlık durum + mesafe özeti:\n\n• Kanal içinde — % tabandan · % tavana (toplamı 100%)\n• Yukarı/Aşağı Kırılım — fiyat kanaldan çıktı, kırılım fiyatı ve sınırın ötesindeki % ile gösterilir\n• Retest — sınırdan ≥1σ uzaklaştıktan sonra fiyat geri dönüp sınırı test etti\n\n✓ = onaylı (retest edildi ve ≥1σ geri döndü).\n(sıçrama) = fiyat tek hamlede tüm kanalı aştı.\n\nTüm mesafeler kanal genişliğinin %'sidir (ölçekten bağımsız). σ eşikleri dinamiktir (Yang-Zhang).",
    lbl_close: "Kapanış",
    lbl_ceiling: "Tavan",
    lbl_floor: "Taban",
    lbl_ext: "Uzanım",
    lbl_trend_tip: "Trend",
    lbl_angle: "Açı",
    lbl_blocks: "Blok",
    alert_warn: "Alarmlar için Calculation Bar = Live Bar olmalı",
    alert_warn_tip: "Alarmlar şu anda etkin ancak Calculation Bar = Close Bar.\n\nClose Bar modu hesaplamaları son kapanan bara sabitler ve bu, canlı alarmlarla anlamsal olarak bağdaşmaz. Alarmları gecikmesiz tetiklemek için gösterge ayarlarını açıp Calculation Bar değerini Live Bar olarak değiştir.\n\nO zamana kadar tüm alertcondition'lar bastırılır.",
  },
  "العربية": {
    lbl_period: "فترة",
    lbl_trend: "اتجاه",
    lbl_agreement: "توافق",
    dir_up: "صعود",
    dir_dn: "هبوط",
    dir_rng: "عرضي",
    st_bo_up: "اختراق صاعد",
    st_bo_dn: "اختراق هابط",
    st_rt_up_broke_at: "اختبار صاعد · اختراق",
    st_rt_dn_broke_at: "اختبار هابط · اختراق",
    st_inside: "داخل القناة",
    st_inside_dir_ch: "داخل القناة · تغيّر الاتجاه",
    st_inside_fail_up: "داخل القناة · اختراق صاعد فاشل",
    st_inside_fail_dn: "داخل القناة · اختراق هابط فاشل",
    conn_at: "@",
    conn_gap: "(فجوة)",
    conn_retested: "· أُعيد اختباره",
    conn_now: "الآن",
    dist_above_ceiling: "% فوق السقف",
    dist_below_floor: "% تحت الأرضية",
    dist_from_floor: "% من الأرضية",
    dist_to_ceiling: "% إلى السقف",
    tip_header: "ST-EP06 — Smart Trader، الحلقة 6: خطوط الاتجاه الإيزوتروبية.\n\nقنوات اتجاه متعددة المقاييس في فضاء إحداثيات معياري σ (ICS). سعر العنوان دائماً إغلاق مباشر (Live Exception). جميع القيم الأخرى مرجعها الشمعة المختارة عبر Calculation Bar — [0] في وضع Live Bar، [1] في وضع Close Bar.",
    tip_period: "فترات الكتل للتحليل المتوازي على 6 مقاييس.\n\nكل مقياس يقسم التاريخ إلى كتل ويختزل كل كتلة إلى متوسط هندسي لنقطة منتصف السجل.\n\nعمود '19' = المحرك الأساسي (يستخدم مدخل الفترة لديك). الأخرى تستخدم فترات ثابتة للتوافق بين المقاييس.",
    tip_trend: "اتجاه الترند لكل مقياس من أطول مقطع رتيب لمتوسطات الكتل الهندسية.\n\n▲ صعود · ▼ هبوط · ◈ عرضي\n\nعرضي = زاوية ICS المطلقة ضمن ±عتبة النطاق. الزاوية هي أركتان للميل المعياري بـσ، قابلة للمقارنة عبر الأسواق.",
    tip_agreement: "التوافق بين المقاييس.\n\nكم عدد المقاييس الستة المتفقة على الاتجاه، معروضاً مع القناة الأساسية ▲ (السقف) و▼ (الأرضية).\n\n5/6 أو 6/6 = اتجاه هيكلي مرئي في كل دقة زمنية.",
    tip_narrative: "سرد الاختراق / إعادة الاختبار (المحرك الأساسي، مقياس 19).\n\nسطر واحد للحالة + ملخص المسافة:\n\n• داخل القناة — % من الأرضية · % إلى السقف (المجموع 100%)\n• اختراق صاعد/هابط — السعر خرج من القناة، معروض مع سعر الاختراق و% خارج الحدود\n• إعادة الاختبار — بعد التحرك ≥1σ عن الحد، عاد السعر ليختبره\n\n✓ = مؤكّد (أُعيد اختباره وارتد ≥1σ).\n(فجوة) = السعر عبر القناة بالكامل في حركة واحدة.\n\nجميع المسافات % من عرض القناة (مستقلة عن المقياس). عتبات σ ديناميكية (يانغ-زانغ).",
    lbl_close: "إغلاق",
    lbl_ceiling: "السقف",
    lbl_floor: "الأرضية",
    lbl_ext: "امتداد",
    lbl_trend_tip: "اتجاه",
    lbl_angle: "زاوية",
    lbl_blocks: "كتل",
    alert_warn: "التنبيهات تتطلب Calculation Bar = Live Bar",
    alert_warn_tip: "التنبيهات مفعّلة حالياً لكن Calculation Bar معيّن على Close Bar.\n\nوضع Close Bar يثبّت الحسابات على آخر شمعة مغلقة، وهذا لا يتوافق دلالياً مع التنبيهات الحيّة. لإطلاق التنبيهات دون تأخير، افتح إعدادات المؤشر وغيّر Calculation Bar إلى Live Bar.\n\nحتى ذلك الحين، تُكتم جميع alertcondition.",
  },
  "Русский": {
    lbl_period: "Период",
    lbl_trend: "Тренд",
    lbl_agreement: "Согласие",
    dir_up: "РОСТ",
    dir_dn: "СПАД",
    dir_rng: "ФЛЭТ",
    st_bo_up: "Пробой вверх",
    st_bo_dn: "Пробой вниз",
    st_rt_up_broke_at: "Ретест вверх · пробой",
    st_rt_dn_broke_at: "Ретест вниз · пробой",
    st_inside: "Внутри канала",
    st_inside_dir_ch: "Внутри канала · смена направления",
    st_inside_fail_up: "Внутри канала · неудачный пробой вверх",
    st_inside_fail_dn: "Внутри канала · неудачный пробой вниз",
    conn_at: "@",
    conn_gap: "(гэп)",
    conn_retested: "· ретест",
    conn_now: "сейчас",
    dist_above_ceiling: "% над потолком",
    dist_below_floor: "% под полом",
    dist_from_floor: "% от пола",
    dist_to_ceiling: "% до потолка",
    tip_header: "ST-EP06 — Smart Trader, Эпизод 6: Изотропные линии тренда.\n\nМногомасштабные трендовые каналы в σ-нормализованном координатном пространстве (ICS). Цена заголовка всегда живое закрытие (Live Exception). Все остальные значения привязаны к свече, выбранной через Calculation Bar — [0] в режиме Live Bar, [1] в режиме Close Bar.",
    tip_period: "Периоды блоков для параллельного анализа на 6 масштабах.\n\nКаждый масштаб разбивает историю на блоки и сводит каждый блок к геометрическому среднему лог-середины.\n\nКолонка '19' = основной движок (использует ваш ввод Периода). Остальные используют фиксированные периоды для межмасштабного согласия.",
    tip_trend: "Направление тренда по каждому масштабу из самого длинного монотонного сегмента геометрических средних блоков.\n\n▲ РОСТ · ▼ СПАД · ◈ ФЛЭТ\n\nФЛЭТ = абсолютный ICS-угол в пределах ±Порога Диапазона. Угол — арктангенс σ-нормализованного наклона, сопоставимого между рынками.",
    tip_agreement: "Межмасштабное согласие.\n\nСколько из 6 масштабов согласны по направлению, показано с основным каналом ▲ (потолок) и ▼ (пол).\n\n5/6 или 6/6 = структурный тренд виден на каждом временном разрешении.",
    tip_narrative: "Нарратив пробоя / ретеста (основной движок, масштаб 19).\n\nОднострочная сводка состояния + дистанции:\n\n• Внутри — % от пола · % до потолка (сумма 100%)\n• Пробой вверх/вниз — цена вышла из канала, показано с ценой пробоя и % за границей\n• Ретест — после движения ≥1σ от границы цена вернулась её проверить\n\n✓ = подтверждено (ретест и отскок ≥1σ).\n(гэп) = цена пересекла весь канал одним движением.\n\nВсе дистанции — % ширины канала (независимы от масштаба). Пороги σ динамические (Янг-Чжан).",
    lbl_close: "Закрытие",
    lbl_ceiling: "Потолок",
    lbl_floor: "Пол",
    lbl_ext: "Расширение",
    lbl_trend_tip: "Тренд",
    lbl_angle: "Угол",
    lbl_blocks: "Блоки",
    alert_warn: "Оповещениям требуется Calculation Bar = Live Bar",
    alert_warn_tip: "Оповещения включены, но Calculation Bar установлен на Close Bar.\n\nРежим Close Bar привязывает расчёты к последней закрытой свече, что семантически несовместимо с живыми оповещениями. Чтобы оповещения срабатывали без задержки, откройте настройки индикатора и смените Calculation Bar на Live Bar.\n\nДо этого все alertcondition подавляются.",
  },
  "Italiano": {
    lbl_period: "Periodo",
    lbl_trend: "Trend",
    lbl_agreement: "Consenso",
    dir_up: "SU",
    dir_dn: "GIÙ",
    dir_rng: "LAT",
    st_bo_up: "Rottura rialzista",
    st_bo_dn: "Rottura ribassista",
    st_rt_up_broke_at: "Retest al rialzo · rottura",
    st_rt_dn_broke_at: "Retest al ribasso · rottura",
    st_inside: "Dentro il canale",
    st_inside_dir_ch: "Dentro il canale · direzione cambiata",
    st_inside_fail_up: "Dentro il canale · rottura rialzista fallita",
    st_inside_fail_dn: "Dentro il canale · rottura ribassista fallita",
    conn_at: "@",
    conn_gap: "(gap)",
    conn_retested: "· ritestato",
    conn_now: "ora",
    dist_above_ceiling: "% sopra il tetto",
    dist_below_floor: "% sotto il pavimento",
    dist_from_floor: "% dal pavimento",
    dist_to_ceiling: "% al tetto",
    tip_header: "ST-EP06 — Smart Trader, Episodio 6: Linee di Tendenza Isotropiche.\n\nCanali di tendenza multi-scala in spazio coordinate normalizzato σ (ICS). Il prezzo dell'intestazione è sempre la chiusura live (Live Exception). Tutti gli altri valori sono ancorati alla barra selezionata tramite Calculation Bar — [0] in modalità Live Bar, [1] in modalità Close Bar.",
    tip_period: "Periodi dei blocchi per l'analisi parallela a 6 scale.\n\nOgni scala partiziona la storia in blocchi e riduce ciascuno alla media geometrica del log-midpoint.\n\nLa colonna '19' = motore primario (usa il tuo input Periodo). Le altre usano periodi fissi per il consenso tra scale.",
    tip_trend: "Direzione di tendenza per scala dal segmento monotono più lungo delle medie geometriche dei blocchi.\n\n▲ SU · ▼ GIÙ · ◈ LAT\n\nLAT = angolo ICS assoluto entro ±Soglia di Range. L'angolo è l'arcotangente della pendenza normalizzata σ, confrontabile tra i mercati.",
    tip_agreement: "Consenso tra scale.\n\nQuante delle 6 scale concordano sulla direzione, mostrato con il canale primario ▲ (tetto) e ▼ (pavimento).\n\n5/6 o 6/6 = tendenza strutturale visibile a ogni risoluzione temporale.",
    tip_narrative: "Narrativa rottura / retest (motore primario, scala 19).\n\nRiassunto su una riga di stato + distanza:\n\n• Dentro — % dal pavimento · % al tetto (somma 100%)\n• Rottura su/giù — il prezzo è uscito dal canale, mostrato con prezzo di rottura e % oltre il confine\n• Retest — dopo essersi mosso ≥1σ dal confine, il prezzo è tornato a testarlo\n\n✓ = confermato (ritestato e rimbalzato ≥1σ).\n(gap) = il prezzo ha attraversato l'intero canale in un'unica mossa.\n\nTutte le distanze sono % della larghezza del canale (indipendenti dalla scala). Le soglie σ sono dinamiche (Yang-Zhang).",
    lbl_close: "Chiusura",
    lbl_ceiling: "Tetto",
    lbl_floor: "Pavimento",
    lbl_ext: "Estensione",
    lbl_trend_tip: "Trend",
    lbl_angle: "Angolo",
    lbl_blocks: "Blocchi",
    alert_warn: "Gli avvisi richiedono Calculation Bar = Live Bar",
    alert_warn_tip: "Gli avvisi sono attualmente abilitati ma Calculation Bar è impostato su Close Bar.\n\nLa modalità Close Bar ancora i calcoli all'ultima barra chiusa, il che è semanticamente incompatibile con gli avvisi live. Per attivare gli avvisi senza ritardo, apri le impostazioni dell'indicatore e cambia Calculation Bar in Live Bar.\n\nFino ad allora, tutte le alertcondition sono soppresse.",
  },
  "Português (BR)": {
    lbl_period: "Período",
    lbl_trend: "Tendência",
    lbl_agreement: "Consenso",
    dir_up: "ALTA",
    dir_dn: "BAIXA",
    dir_rng: "LAT",
    st_bo_up: "Rompimento de alta",
    st_bo_dn: "Rompimento de baixa",
    st_rt_up_broke_at: "Reteste de alta · rompimento",
    st_rt_dn_broke_at: "Reteste de baixa · rompimento",
    st_inside: "Dentro do canal",
    st_inside_dir_ch: "Dentro do canal · direção mudou",
    st_inside_fail_up: "Dentro do canal · rompimento de alta falhou",
    st_inside_fail_dn: "Dentro do canal · rompimento de baixa falhou",
    conn_at: "@",
    conn_gap: "(gap)",
    conn_retested: "· retestado",
    conn_now: "agora",
    dist_above_ceiling: "% acima do teto",
    dist_below_floor: "% abaixo do piso",
    dist_from_floor: "% do piso",
    dist_to_ceiling: "% ao teto",
    tip_header: "ST-EP06 — Smart Trader, Episódio 6: Linhas de Tendência Isotrópicas.\n\nCanais de tendência multi-escala em espaço de coordenadas normalizado por σ (ICS). O preço do cabeçalho é sempre o fechamento ao vivo (Live Exception). Todos os outros valores estão ancorados à barra selecionada via Calculation Bar — [0] no modo Live Bar, [1] no modo Close Bar.",
    tip_period: "Períodos dos blocos para a análise paralela em 6 escalas.\n\nCada escala particiona o histórico em blocos e reduz cada um à média geométrica do log-midpoint.\n\nA coluna '19' = motor primário (usa seu input de Período). As outras usam períodos fixos para o consenso entre escalas.",
    tip_trend: "Direção da tendência por escala do segmento monotônico mais longo das médias geométricas dos blocos.\n\n▲ ALTA · ▼ BAIXA · ◈ LAT\n\nLAT = ângulo ICS absoluto dentro de ±Limite de Range. O ângulo é o arctangente da inclinação normalizada por σ, comparável entre mercados.",
    tip_agreement: "Consenso entre escalas.\n\nQuantas das 6 escalas concordam na direção, mostrado com o canal primário ▲ (teto) e ▼ (piso).\n\n5/6 ou 6/6 = tendência estrutural visível em toda resolução temporal.",
    tip_narrative: "Narrativa de rompimento / reteste (motor primário, escala 19).\n\nResumo em uma linha de estado + distância:\n\n• Dentro — % do piso · % ao teto (soma 100%)\n• Rompimento de alta/baixa — o preço saiu do canal, mostrado com preço de rompimento e % além do limite\n• Reteste — após se mover ≥1σ do limite, o preço voltou para testá-lo\n\n✓ = confirmado (retestado e distanciou-se ≥1σ).\n(gap) = o preço atravessou todo o canal em um único movimento.\n\nTodas as distâncias são % da largura do canal (independentes da escala). Os limites σ são dinâmicos (Yang-Zhang).",
    lbl_close: "Fechamento",
    lbl_ceiling: "Teto",
    lbl_floor: "Piso",
    lbl_ext: "Extensão",
    lbl_trend_tip: "Tendência",
    lbl_angle: "Ângulo",
    lbl_blocks: "Blocos",
    alert_warn: "Alertas exigem Calculation Bar = Live Bar",
    alert_warn_tip: "Os alertas estão atualmente ativados, mas Calculation Bar está definido como Close Bar.\n\nO modo Close Bar ancora os cálculos na última barra fechada, o que é semanticamente incompatível com alertas ao vivo. Para disparar alertas sem atraso, abra as configurações do indicador e altere Calculation Bar para Live Bar.\n\nAté lá, todos os alertcondition são suprimidos.",
  },
  "中文": {
    lbl_period: "周期",
    lbl_trend: "趋势",
    lbl_agreement: "一致度",
    dir_up: "上涨",
    dir_dn: "下跌",
    dir_rng: "横盘",
    st_bo_up: "向上突破",
    st_bo_dn: "向下突破",
    st_rt_up_broke_at: "上破回踩 · 突破",
    st_rt_dn_broke_at: "下破回踩 · 突破",
    st_inside: "通道内",
    st_inside_dir_ch: "通道内 · 方向改变",
    st_inside_fail_up: "通道内 · 向上突破失败",
    st_inside_fail_dn: "通道内 · 向下突破失败",
    conn_at: "@",
    conn_gap: "(跳空)",
    conn_retested: "· 回踩",
    conn_now: "现在",
    dist_above_ceiling: "% 高于顶部",
    dist_below_floor: "% 低于底部",
    dist_from_floor: "% 距底部",
    dist_to_ceiling: "% 距顶部",
    tip_header: "ST-EP06 — Smart Trader 第 6 集：各向同性趋势线。\n\n基于 σ 标准化坐标空间（ICS）的多尺度趋势通道。标题价格始终为实时收盘（Live Exception）。所有其他值锚定于通过 Calculation Bar 选择的 K 线 — Live Bar 模式为 [0]，Close Bar 模式为 [1]。",
    tip_period: "用于 6 尺度并行分析的区块周期。\n\n每个尺度将历史划分为区块，并将每个区块归约为对数中点几何平均值。\n\n'19' 列 = 主引擎（使用您的周期输入）。其他列使用固定周期以实现跨尺度共识。",
    tip_trend: "每个尺度的趋势方向，来自区块几何平均值最长的单调段。\n\n▲ 上涨 · ▼ 下跌 · ◈ 横盘\n\n横盘 = ±范围阈值内的绝对 ICS 角度。角度是 σ 标准化斜率的反正切，可跨市场比较。",
    tip_agreement: "跨尺度一致度。\n\n6 个尺度中有多少在方向上一致，与主通道 ▲（顶部）和 ▼（底部）一同显示。\n\n5/6 或 6/6 = 在每个时间分辨率上均可见的结构性趋势。",
    tip_narrative: "突破 / 回踩叙述（主引擎，尺度 19）。\n\n一行状态 + 距离摘要：\n\n• 通道内 — % 距底部 · % 距顶部（总和 100%）\n• 向上/下突破 — 价格离开通道，显示突破价及超出边界的百分比\n• 回踩 — 价格从边界移动 ≥1σ 后，返回测试边界\n\n✓ = 已确认（回踩后反弹 ≥1σ）。\n(跳空) = 价格在一次移动中穿越整个通道。\n\n所有距离均为通道宽度的百分比（与尺度无关）。σ 阈值为动态（Yang-Zhang）。",
    lbl_close: "收盘",
    lbl_ceiling: "顶部",
    lbl_floor: "底部",
    lbl_ext: "延伸",
    lbl_trend_tip: "趋势",
    lbl_angle: "角度",
    lbl_blocks: "区块",
    alert_warn: "警报需要 Calculation Bar = Live Bar",
    alert_warn_tip: "警报当前已启用，但 Calculation Bar 设置为 Close Bar。\n\nClose Bar 模式将计算锚定在最后收盘的 K 线上，这与实时警报在语义上不兼容。为了让警报无延迟触发，请打开指标设置并将 Calculation Bar 更改为 Live Bar。\n\n在此之前，所有 alertcondition 都被抑制。",
  },
};

/** Tooltips of the inputs, as the original */
const TIP = {
  calcBar: "Which bar anchors every structural computation — σ, blocks, channel, state machine, and dashboard narrative.\n\nLive Bar (default): anchor = bar [0]. Values update with every tick and repaint within the bar — standard behavior.\n\nClose Bar: anchor = bar [1]. Values lock on bar close and never repaint — safer for back-testing and structural analysis.\n\nDashboard header price always shows live close in both modes (Live Exception).",
  period: "Number of bars per structural block. Price history is partitioned into consecutive blocks of this length; each reduces to a geometric mean (log-midpoint of High/Low).\n\nLarger → captures slower structural moves.\nSmaller → faster response, may overfit noise.\n\nTotal lookback = Period × Groups.\nDrives the primary engine (scale 19). Default: 26.",
  groups: "Number of consecutive blocks compared for direction detection and channel fitting. All 6 scales use this same value.\n\nThe largest scale (47) consumes 47 x Groups candles. Range is capped at 5 to stay within platform limits (max 235 candles for Scale 47).\n\n3 groups = fast adaptation\n5 groups = deeper structural view\n\nTotal lookback for primary engine = Period x Groups. Default: 5.",
  thresh: "ICS angle threshold in degrees. When the trend angle falls between −Threshold and +Threshold, direction is classified as FLAT (ranging) instead of UP or DOWN.\n\nHigher → wider neutral zone, filters weak trends.\nLower → more directional sensitivity.\n\nRange: 0°–45°. Default: 0.5°.",
  sigmaLen: "Lookback for the Yang-Zhang (2000) realized volatility estimator. This σ normalizes log-price into the Isotropic Coordinate System (ICS), making trend angles comparable across instruments, timeframes, and volatility regimes.\n\nShorter → faster reaction to volatility shifts.\nLonger → smoother, more stable σ.\nDefault: 20.",
  clrUp: "Channel line color during an uptrend (DIR_UP).",
  clrDn: "Channel line color during a downtrend (DIR_DOWN).",
  clrRng: "Channel line color during a ranging market (DIR_FLAT).",
  chW: "Pixel width of the solid channel boundary lines (upper and lower). Projection lines have a separate width setting.",
  chSty: "Visual style of the solid channel lines. Projection lines have a separate style setting.",
  pjOff: "Bars to extend the channel forward beyond the last confirmed bar. Projection extrapolates channel slope as a visual reference for potential support/resistance.\n\nLarger → longer forward view.\nSmaller → tighter projection.\n\nNo new data consumed — purely geometric. Default: 7.",
  pjW: "Pixel width of the forward projection lines.",
  pjSty: "Visual style of the forward projection lines.",
  lang: "Dashboard display language.\n\nEN · TR · AR · RU · IT · PT-BR · ZH\n\nCJK (Chinese) renders using the default font of the platform — no special setup required.",
  showCh: "Toggle all chart-overlay elements: channel lines, projection, fill, markers, and direction label. Dashboard is controlled separately.",
  showFill: "Toggle the semi-transparent fill between channel boundaries. Applies to both the solid channel and the dotted projection segments.",
  showDash: "Toggle the dashboard table (top-right) showing scale periods, per-scale trends, consensus, channel levels, and breakout/retest narrative.",
  dashSz: "Base font size for dashboard text. Header = size − 2, detail rows = size − 4. Also affects diamond markers and direction label. Minimum effective: 6. Default: 12.",
  dashPos: "Screen position of the dashboard table.",
  fillUp: "Fill color between channel boundaries during an uptrend. Independent of channel line color — allows distinct visual layering.",
  fillDn: "Fill color between channel boundaries during a downtrend. Independent of channel line color.",
  fillRng: "Fill color between channel boundaries during a ranging market. Independent of channel line color.",
  fillTr: "Channel fill transparency.\n\n0 = fully opaque (solid color).\n100 = fully invisible.\n\nValues 80–90 provide subtle shading without obscuring price action. Default: 85.",
  showBlk: "Toggle block overlay: colored bands for each structural block, dashed Hi/Lo lines, geometric mean dots, and GM connection line.\n\nBlocks are the foundational units of the trend analysis. This toggle makes them visible on the chart for educational and diagnostic purposes.",
  blkClr1: "Background color for even-numbered blocks (0, 2, 4 ...).",
  blkClr2: "Background color for odd-numbered blocks (1, 3, 5 ...).",
  blkTr: "Transparency of block background bands.\n\n90 = subtle shading.\n100 = invisible (border only).\nDefault: 90.",
  blkHiClr: "Color of the dashed line marking the highest High within each block.",
  blkLoClr: "Color of the dashed line marking the lowest Low within each block.",
  blkGmClr: "Color of the geometric mean markers and the line connecting them across blocks.\n\nGM = exp((ln(blockHi) + ln(blockLo)) / 2)\nThe log-midpoint central tendency of each block.",
  showAng: "Toggle the ICS angle reference line: a straight line from the geometric mean of the oldest block in the monotonic segment to the newest, projected forward by Projection Offset bars.\n\nThis is the line whose slope, divided by σ, produces the displayed ICS angle.",
  angClr: "Color of the angle reference line and its forward projection.",
  showAngLbl: "Toggle the direction and angle label (e.g. ▼ DN −0.8°).\n\nWhen Show Angle Line is ON the label sits at the projection end of the angle line. When Show Angle Line is OFF the label falls back to the channel midpoint.",
  enableAlerts: "Master toggle for 19 alert conditions (D · B · R · S · A).\n\nREQUIRES Calculation Bar = Live Bar. In Close Bar mode, alerts are auto-suppressed and a warning label is shown on the chart — because alerts must react to live state, and Close Bar intentionally lags by one bar.\n\nEnable this before creating alerts in the alert dialog. Default: OFF.",
};
// ── End of the language tables ──

export interface SmartTraderEpisode06IsotropicTrendLinesInputs {
  calcBar: 'Live Bar' | 'Close Bar';
  period: number;
  groups: number;
  thresh: number;
  sigmaLen: number;
  clrUp: string;
  clrDn: string;
  clrRng: string;
  chW: number;
  chSty: StyleName;
  pjOff: number;
  pjW: number;
  pjSty: StyleName;
  lang: Lang;
  showCh: boolean;
  showFill: boolean;
  showDash: boolean;
  dashSz: number;
  dashPos: DashPos;
  fillUp: string;
  fillDn: string;
  fillRng: string;
  fillTr: number;
  showBlk: boolean;
  blkClr1: string;
  blkClr2: string;
  blkTr: number;
  blkHiClr: string;
  blkLoClr: string;
  blkGmClr: string;
  showAng: boolean;
  angClr: string;
  showAngLbl: boolean;
  enableAlerts: boolean;
}

export const defaultInputs: SmartTraderEpisode06IsotropicTrendLinesInputs = {
  calcBar: 'Live Bar',
  period: 13,
  groups: 5,
  thresh: 0.5,
  sigmaLen: 20,
  clrUp: '#26a69a',
  clrDn: '#ef5350',
  clrRng: '#888888',
  chW: 2,
  chSty: 'Solid',
  pjOff: 7,
  pjW: 2,
  pjSty: 'Dotted',
  lang: 'English',
  showCh: true,
  showFill: true,
  showDash: true,
  dashSz: 12,
  dashPos: 'Top Right',
  fillUp: '#26a69a',
  fillDn: '#ef5350',
  fillRng: '#888888',
  fillTr: 85,
  showBlk: false,
  blkClr1: '#7F77DD',
  blkClr2: '#1D9E75',
  blkTr: 90,
  blkHiClr: '#E24B4A',
  blkLoClr: '#378ADD',
  blkGmClr: '#EF9F27',
  showAng: false,
  angClr: '#AFA9EC',
  showAngLbl: false,
  enableAlerts: false,
};

const GP_CALC = 'Calculation';
const GP_CH = 'Channel Lines';
const GP_PJ = 'Projection Lines';
const GP_DSP = 'Display';
const GP_FILL = 'Channel Fill';
const GP_BLK = 'Block Visualization';
const GP_ALERTS = 'Alerts';
const STYLES = ['Solid', 'Dashed', 'Dotted'];

export const inputConfig: InputConfig[] = [
  { id: 'calcBar', type: 'string', title: 'Calculation Bar', defval: 'Live Bar', options: ['Live Bar', 'Close Bar'],
    group: GP_CALC, tooltip: TIP.calcBar },
  { id: 'period', type: 'int', title: 'Trend Block Period', defval: 13, min: 5, max: 100, group: GP_CALC,
    tooltip: TIP.period },
  { id: 'groups', type: 'int', title: 'Trend Block Groups', defval: 5, min: 3, max: 5, group: GP_CALC,
    tooltip: TIP.groups },
  { id: 'thresh', type: 'float', title: 'Range Threshold (°)', defval: 0.5, min: 0, max: 45, step: 0.1,
    group: GP_CALC, tooltip: TIP.thresh },
  { id: 'sigmaLen', type: 'int', title: 'Yang-Zhang Sigma Length', defval: 20, min: 5, max: 100, group: GP_CALC,
    tooltip: TIP.sigmaLen },
  { id: 'clrUp', type: 'color', title: 'Up Color', defval: '#26a69a', group: GP_CH, tooltip: TIP.clrUp },
  { id: 'clrDn', type: 'color', title: 'Down Color', defval: '#ef5350', group: GP_CH, tooltip: TIP.clrDn },
  { id: 'clrRng', type: 'color', title: 'Range Color', defval: '#888888', group: GP_CH, tooltip: TIP.clrRng },
  { id: 'chW', type: 'int', title: 'Line Width', defval: 2, min: 1, max: 5, group: GP_CH, tooltip: TIP.chW },
  { id: 'chSty', type: 'string', title: 'Line Style', defval: 'Solid', options: STYLES, group: GP_CH,
    tooltip: TIP.chSty },
  { id: 'pjOff', type: 'int', title: 'Projection Offset', defval: 7, min: 1, max: 100, group: GP_PJ,
    tooltip: TIP.pjOff },
  { id: 'pjW', type: 'int', title: 'Projection Width', defval: 2, min: 1, max: 5, group: GP_PJ, tooltip: TIP.pjW },
  { id: 'pjSty', type: 'string', title: 'Projection Style', defval: 'Dotted', options: STYLES, group: GP_PJ,
    tooltip: TIP.pjSty },
  { id: 'lang', type: 'string', title: 'Language', defval: 'English',
    options: ['English', 'Türkçe', 'العربية', 'Русский', 'Italiano', 'Português (BR)', '中文'], group: GP_DSP,
    tooltip: TIP.lang },
  { id: 'showCh', type: 'bool', title: 'Show Channel', defval: true, group: GP_DSP, tooltip: TIP.showCh },
  { id: 'showFill', type: 'bool', title: 'Show Fill', defval: true, group: GP_DSP, tooltip: TIP.showFill },
  { id: 'showDash', type: 'bool', title: 'Show Dashboard', defval: true, group: GP_DSP, tooltip: TIP.showDash },
  { id: 'dashSz', type: 'int', title: 'Dashboard Font Size', defval: 12, min: 6, max: 50, group: GP_DSP,
    tooltip: TIP.dashSz },
  { id: 'dashPos', type: 'string', title: 'Dashboard Position', defval: 'Top Right',
    options: ['Top Left', 'Top Center', 'Top Right', 'Middle Left', 'Middle Center', 'Middle Right', 'Bottom Left',
      'Bottom Center', 'Bottom Right'], group: GP_DSP, tooltip: TIP.dashPos },
  { id: 'fillUp', type: 'color', title: 'Fill Up Color', defval: '#26a69a', group: GP_FILL, tooltip: TIP.fillUp },
  { id: 'fillDn', type: 'color', title: 'Fill Down Color', defval: '#ef5350', group: GP_FILL, tooltip: TIP.fillDn },
  { id: 'fillRng', type: 'color', title: 'Fill Range Color', defval: '#888888', group: GP_FILL,
    tooltip: TIP.fillRng },
  { id: 'fillTr', type: 'int', title: 'Fill Transparency', defval: 85, min: 0, max: 100, group: GP_FILL,
    tooltip: TIP.fillTr },
  { id: 'showBlk', type: 'bool', title: 'Show Blocks', defval: false, group: GP_BLK, tooltip: TIP.showBlk },
  { id: 'blkClr1', type: 'color', title: 'Block Color (Even)', defval: '#7F77DD', group: GP_BLK,
    tooltip: TIP.blkClr1 },
  { id: 'blkClr2', type: 'color', title: 'Block Color (Odd)', defval: '#1D9E75', group: GP_BLK,
    tooltip: TIP.blkClr2 },
  { id: 'blkTr', type: 'int', title: 'Block Transparency', defval: 90, min: 50, max: 100, group: GP_BLK,
    tooltip: TIP.blkTr },
  { id: 'blkHiClr', type: 'color', title: 'Block High Color', defval: '#E24B4A', group: GP_BLK,
    tooltip: TIP.blkHiClr },
  { id: 'blkLoClr', type: 'color', title: 'Block Low Color', defval: '#378ADD', group: GP_BLK,
    tooltip: TIP.blkLoClr },
  { id: 'blkGmClr', type: 'color', title: 'GM Color', defval: '#EF9F27', group: GP_BLK, tooltip: TIP.blkGmClr },
  { id: 'showAng', type: 'bool', title: 'Show Angle Line', defval: false, group: GP_BLK, tooltip: TIP.showAng },
  { id: 'angClr', type: 'color', title: 'Angle Line Color', defval: '#AFA9EC', group: GP_BLK, tooltip: TIP.angClr },
  { id: 'showAngLbl', type: 'bool', title: 'Show Angle Label', defval: false, group: GP_BLK,
    tooltip: TIP.showAngLbl },
  { id: 'enableAlerts', type: 'bool', title: 'Enable Alerts', defval: false, group: GP_ALERTS,
    tooltip: TIP.enableAlerts },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Angle', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Agreement', color: '#2962FF', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'ChannelPos', color: '#2962FF', lineWidth: 1, display: 'none' },
];

/** The original's alertconditions (all gated by "Enable Alerts" and "Live Bar") */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: '▲ Uptrend Entry', message: '📈 UPTREND — trend turned UP' },
  { id: 'alert1', title: '▼ Downtrend Entry', message: '📉 DOWNTREND — trend turned DOWN' },
  { id: 'alert2', title: '◈ Range Entry', message: '◈ RANGE — trend went FLAT' },
  { id: 'alert3', title: '▲ Breakout Up', message: '🟢 BO UP — price broke above ceiling' },
  { id: 'alert4', title: '✓ BO Up Confirmed', message: '✅ BO UP CONFIRMED — retested and bounced' },
  { id: 'alert5', title: '▼ Breakout Down', message: '🔴 BO DN — price broke below floor' },
  { id: 'alert6', title: '✓ BO Down Confirmed', message: '✅ BO DN CONFIRMED — retested and bounced' },
  { id: 'alert7', title: '↺ Retest Up', message: '↺ RETEST UP — price returning to ceiling' },
  { id: 'alert8', title: '↺ Retest Down', message: '↺ RETEST DN — price returning to floor' },
  { id: 'alert9', title: '⚡ Gap Up Through', message: '⚡ GAP UP — price crossed entire channel upward' },
  { id: 'alert10', title: '⚡ Gap Down Through', message: '⚡ GAP DN — price crossed entire channel downward' },
  { id: 'alert11', title: '✗ Failed Breakout Up', message: '✗ FAILED BO UP — returned inside channel' },
  { id: 'alert12', title: '✗ Failed Breakout Down', message: '✗ FAILED BO DN — returned inside channel' },
  { id: 'alert13', title: '↻ Direction Reset', message: '↻ DIR RESET — trend direction changed, state wiped' },
  { id: 'alert14', title: '🔵 Full Bull 6/6', message: '🔵 FULL BULL — all 6 scales agree UP' },
  { id: 'alert15', title: '🔵 Strong Bull 5/6', message: '🔵 STRONG BULL — 5 of 6 scales agree UP' },
  { id: 'alert16', title: '🔴 Full Bear 6/6', message: '🔴 FULL BEAR — all 6 scales agree DN' },
  { id: 'alert17', title: '🔴 Strong Bear 5/6', message: '🔴 STRONG BEAR — 5 of 6 scales agree DN' },
  { id: 'alert18', title: '◈ Range Consensus ≥4/6', message: '◈ RANGE CONSENSUS — ≥4 of 6 scales in RNG' },
];

export const drawingKinds: StudyDrawingKind[] = ['line', 'linefill', 'label', 'box', 'table'];

export const metadata = {
  title: 'Smart Trader, Episode 06, Isotropic Trend Lines',
  shortTitle: 'ST-EP06',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !lt(a, b);
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !gt(a, b);
const ne = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && Math.abs(a - b) > EPS;
const na = (x: number) => !Number.isFinite(x);
const nz = (x: number, d = 0) => (na(x) ? d : x);

const DIR_UP = 1;
const DIR_DOWN = -1;
const DIR_FLAT = 0;
const MIN_SIGMA = 1e-10;
const SCALES = [3, 7, 13, 19, 29, 47];
const ST_INSIDE = 0;
const ST_BO_UP = 1;
const ST_RT_UP = 2;
const ST_BO_DN = -1;
const ST_RT_DN = -2;

/** Output of one trend analysis (the original's TrendResult) */
interface TrendResult {
  dir: number;
  angle: number;
  segEnd: number;
  chUpper: number;
  chLower: number;
}

/** Blocks of one scale on one bar: geometric mean, high, low and centre bar of each block (0 = newest) */
interface Blocks {
  gm: number[];
  hi: number[];
  lo: number[];
  cx: number[];
}

/** Linear interpolation in the isotropic space between two price points: the price at targetX */
function icsLine(p1: number, x1: number, p2: number, x2: number, targetX: number, sig: number): number {
  let out = p1;
  if (x1 !== x2 && gt(p1, 0) && gt(p2, 0) && gt(sig, MIN_SIGMA)) {
    const y1 = Math.log(p1) / sig;
    const y2 = Math.log(p2) / sig;
    const yT = y1 + (y2 - y1) * (targetX - x1) / (x2 - x1);
    out = Math.exp(yT * sig);
  }
  return out;
}

/** Angle (degrees) of the isotropic slope between two price points */
function icsAngle(p1: number, x1: number, p2: number, x2: number, sig: number): number {
  let out = 0.0;
  if (x1 !== x2 && gt(p1, 0) && gt(p2, 0) && gt(sig, MIN_SIGMA)) {
    const y1 = Math.log(p1) / sig;
    const y2 = Math.log(p2) / sig;
    out = Math.atan((y2 - y1) / (x2 - x1)) * 180.0 / Math.PI;
  }
  return out;
}

/** Position of p in the log-linear channel [pLo, pHi]: 0 = floor, 1 = ceiling */
function icsPos(p: number, pLo: number, pHi: number, sig: number): number {
  let out = 0.5;
  if (gt(p, 0) && gt(pLo, 0) && gt(pHi, 0) && gt(pHi, pLo) && gt(sig, MIN_SIGMA)) {
    const y = Math.log(p) / sig;
    const yLo = Math.log(pLo) / sig;
    const yHi = Math.log(pHi) / sig;
    out = (y - yLo) / (yHi - yLo);
  }
  return out;
}

/** The four block extremes of the segment (blocks 0 to seg) with their centre bars */
function extremes(b: Blocks, seg: number) {
  let fHH = NaN, fLH = NaN, fHL = NaN, fLL = NaN;
  let xHH = NaN, xLH = NaN, xHL = NaN, xLL = NaN;
  for (let k = 0; k <= seg; k++) {
    const h = b.hi[k];
    const l = b.lo[k];
    const x = b.cx[k];
    if (na(fHH) || gt(h, fHH)) { fHH = h; xHH = x; }
    if (na(fLH) || lt(h, fLH)) { fLH = h; xLH = x; }
    if (na(fHL) || gt(l, fHL)) { fHL = l; xHL = x; }
    if (na(fLL) || lt(l, fLL)) { fLL = l; xLL = x; }
  }
  return { fHH, fLH, fHL, fLL, xHH, xLH, xHL, xLL };
}

/** The original's f_analyze (and the primary engine, which has the same logic): direction, angle, channel */
function analyze(b: Blocks, groups: number, thresh: number, sig: number, now: number): TrendResult {
  let d = DIR_FLAT;
  let a = 0.0;
  let se = 0;
  let cu = NaN;
  let cd = NaN;
  const gm = b.gm;
  if (gm.length >= 2) {
    const g0 = gm[0];
    const g1 = gm[1];
    if (!na(g0) && !na(g1) && ne(g0, g1)) {
      const pd = gt(g0, g1) ? DIR_UP : DIR_DOWN;
      se = 1;
      if (groups > 2) {
        for (let k = 1; k <= groups - 2; k++) {
          if (k + 1 >= gm.length) break;
          const gA = gm[k];
          const gB = gm[k + 1];
          if (!na(gA) && !na(gB)) {
            if ((gt(gA, gB) ? DIR_UP : lt(gA, gB) ? DIR_DOWN : DIR_FLAT) === pd) se = k + 1;
            else break;
          } else {
            break;
          }
        }
      }
      if (gm.length > se) a = icsAngle(gm[se], b.cx[se], gm[0], b.cx[0], sig);
      d = le(Math.abs(a), thresh) ? DIR_FLAT : pd;
      if (se >= 1 && b.hi.length > se) {
        const e = extremes(b, se);
        if (d === DIR_UP) {
          cu = icsLine(e.fLH, e.xLH, e.fHH, e.xHH, now, sig);
          cd = icsLine(e.fLL, e.xLL, e.fHL, e.xHL, now, sig);
        } else if (d === DIR_DOWN) {
          cu = icsLine(e.fHH, e.xHH, e.fLH, e.xLH, now, sig);
          cd = icsLine(e.fHL, e.xHL, e.fLL, e.xLL, now, sig);
        } else {
          cu = nz(e.fHH);
          cd = nz(e.fLL);
        }
      }
    }
  }
  return { dir: d, angle: a, segEnd: se, chUpper: cu, chLower: cd };
}

const lineStyle = (s: StyleName): LineStyle => (s === 'Dashed' ? 'dashed' : s === 'Dotted' ? 'dotted' : 'solid');

const POSITIONS: Record<DashPos, TablePosition> = {
  'Top Left': 'top_left', 'Top Center': 'top_center', 'Top Right': 'top_right', 'Middle Left': 'middle_left',
  'Middle Center': 'middle_center', 'Middle Right': 'middle_right', 'Bottom Left': 'bottom_left',
  'Bottom Center': 'bottom_center', 'Bottom Right': 'bottom_right',
};

export function calculate(
  bars: Bar[],
  inputs: Partial<SmartTraderEpisode06IsotropicTrendLinesInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { alerts: AlertConditionState[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const L: I18n = I18N[cfg.lang] ?? I18N_EN;
  const mintick = mintickOf(chart);
  const fmt = (x: number) => str.tostring(x, 'mintick', mintick);
  const bgColor = backgroundColorOf(chart);
  const fgColor = foregroundColorOf(chart);
  const anchor = cfg.calcBar === 'Live Bar' ? 0 : 1;
  const period = cfg.period;
  const groups = cfg.groups;

  const O = bars.map((b) => b.open);
  const H = bars.map((b) => b.high);
  const Lo = bars.map((b) => b.low);
  const C = bars.map((b) => b.close);
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const S = (arr: number[]) => Series.fromArray(bars, arr);
  const at = (arr: number[], j: number) => (j >= 0 && j < n ? arr[j] : NaN);

  // Yang-Zhang sigma at the anchor bar
  const yzOR: number[] = [];
  const yzCO: number[] = [];
  const yzRS: number[] = [];
  for (let i = 0; i < n; i++) {
    const o = at(O, i - anchor);
    const h = at(H, i - anchor);
    const l = at(Lo, i - anchor);
    const c = at(C, i - anchor);
    yzOR.push(Math.log(o / nz(at(C, i - anchor - 1), o)));
    yzCO.push(Math.log(c / o));
    const ho = Math.log(h / o);
    const hc = Math.log(h / c);
    const lo = Math.log(l / o);
    const lc = Math.log(l / c);
    yzRS.push(ho * hc + lo * lc);
  }
  const len = cfg.sigmaLen;
  const sqOR = A(ta.variance(S(yzOR), len));
  const sqCO = A(ta.variance(S(yzCO), len));
  const sqRS = A(ta.sma(S(yzRS), len));
  const k = 0.34 / (1.34 + (len + 1.0) / Math.max(len - 1.0, 1.0));
  const sigma = sqOR.map((_, i) => {
    const sq = nz(sqOR[i]) + k * nz(sqCO[i]) + (1.0 - k) * nz(sqRS[i]);
    return Math.max(Math.sqrt(Math.max(sq, 0.0)), MIN_SIGMA);
  });

  // ta.highest / ta.lowest of the primary period and of the 6 scales
  const highS = S(H);
  const lowS = S(Lo);
  const hhP = A(ta.highest(highS, period));
  const llP = A(ta.lowest(lowS, period));
  const hhK = SCALES.map((p) => A(ta.highest(highS, p)));
  const llK = SCALES.map((p) => A(ta.lowest(lowS, p)));

  const blocksOf = (i: number, hh: number[], ll: number[], per: number, grp: number): Blocks => {
    const b: Blocks = { gm: [], hi: [], lo: [], cx: [] };
    for (let g = 0; g < grp; g++) {
      const off = anchor + g * per;
      const hi = at(hh, i - off);
      const lo = at(ll, i - off);
      b.gm.push(gt(hi, 0) && gt(lo, 0) ? Math.exp((Math.log(hi) + Math.log(lo)) / 2.0) : NaN);
      b.hi.push(hi);
      b.lo.push(lo);
      b.cx.push(i - off - Math.trunc(per / 2));
    }
    return b;
  };
  const EMPTY: TrendResult = { dir: DIR_FLAT, angle: 0.0, segEnd: 0, chUpper: NaN, chLower: NaN };

  // Drawings: on the last closed bar and on the last bar (barstate.islastconfirmedhistory or barstate.islast)
  resetDrawings({ line: 50, label: 50, box: 20 });
  const upLn = varDrawing<Line>();
  const loLn = varDrawing<Line>();
  const upPj = varDrawing<Line>();
  const loPj = varDrawing<Line>();
  const chFill = varDrawing<Linefill>();
  const pjFill = varDrawing<Linefill>();
  const lbl = varDrawing<Label>();
  const mkUp = varDrawing<Label>();
  const mkLo = varDrawing<Label>();
  const angLn = varDrawing<Line>();
  const angPj = varDrawing<Line>();
  const alertWarn = varDrawing<Label>();
  let dash: Table | undefined;
  let blkBoxes: Box[] = [];
  let blkHiLns: Line[] = [];
  let blkLoLns: Line[] = [];
  let blkGmLbs: Label[] = [];
  let blkGmLns: Line[] = [];
  const lastConfirmed = lastBarConfirmedOf(chart);
  const lastHistory = lastConfirmed ? n - 1 : n - 2;

  const tf = chartTimeframe(bars, chart);
  const tfInfo = tf !== '' ? timeframe.info(tf) : undefined;
  const tfS = tfInfo?.isseconds ? 's' : tfInfo?.isminutes ? 'm' : '';
  const dClr = (d: number) => (d === DIR_UP ? cfg.clrUp : d === DIR_DOWN ? cfg.clrDn : cfg.clrRng);
  const dStr = (d: number) => (d === DIR_UP ? `▲ ${L.dir_up}` : d === DIR_DOWN ? `▼ ${L.dir_dn}` : `◈ ${L.dir_rng}`);
  const fClr = (d: number) => (d === DIR_UP ? cfg.fillUp : d === DIR_DOWN ? cfg.fillDn : cfg.fillRng);
  const bgTransparent = String(color.new(bgColor, 100));

  // State machine (var)
  let boState = ST_INSIDE;
  let boConfirm = false;
  let boDistanced = false;
  let boGapped = false;
  let boPrice = NaN;
  let rtPrice = NaN;
  let prevBDir = DIR_FLAT;
  let retFrom = 0;

  const angPlot: number[] = [];
  const agreePlot: number[] = [];
  const posPlot: number[] = [];
  const hDir: number[] = [];
  const hState: number[] = [];
  const hConfirm: boolean[] = [];
  const hGapped: boolean[] = [];
  const hRetFrom: number[] = [];
  const hReset: boolean[] = [];
  const hUp: number[] = [];
  const hDn: number[] = [];
  const hFlat: number[] = [];

  for (let i = 0; i < n; i++) {
    const trSig = Math.max(nz(sigma[i], MIN_SIGMA), MIN_SIGMA);
    const now = i - anchor;
    const cA = at(C, i - anchor);

    // Primary engine
    const ok = i >= groups * period + anchor;
    const blk: Blocks = ok ? blocksOf(i, hhP, llP, period, groups) : { gm: [], hi: [], lo: [], cx: [] };
    const prim = ok ? analyze(blk, groups, cfg.thresh, trSig, now) : EMPTY;
    const dir = prim.dir;
    const ang = prim.angle;
    const seg = prim.segEnd;
    const chUp = prim.chUpper;
    const chLo = prim.chLower;

    // 6 scales and consensus
    const trends = SCALES.map((p, s) => (i >= groups * p + anchor
      ? analyze(blocksOf(i, hhK[s], llK[s], p, groups), groups, cfg.thresh, trSig, now) : EMPTY));
    let cUp = 0;
    let cDn = 0;
    let cFlat = 0;
    for (const t of trends) {
      if (t.dir === DIR_UP) cUp += 1;
      else if (t.dir === DIR_DOWN) cDn += 1;
      else cFlat += 1;
    }

    // Breakout / retest state machine
    const extPos = icsPos(nz(cA), chLo, chUp, trSig);
    const distUp = !na(chUp) && gt(nz(cA), 0) && gt(chUp, 0) && gt(trSig, MIN_SIGMA)
      ? Math.abs(Math.log(nz(cA)) - Math.log(chUp)) / trSig : 0.0;
    const distDn = !na(chLo) && gt(nz(cA), 0) && gt(chLo, 0) && gt(trSig, MIN_SIGMA)
      ? Math.abs(Math.log(nz(cA)) - Math.log(chLo)) / trSig : 0.0;
    let dirReset = false;
    if (ok && !na(chUp) && !na(chLo)) {
      const dirChg = dir !== prevBDir && prevBDir !== DIR_FLAT;
      prevBDir = dir;
      if (dirChg) {
        dirReset = true;
        boState = ST_INSIDE;
        boConfirm = false;
        boDistanced = false;
        boGapped = false;
        boPrice = NaN;
        rtPrice = NaN;
        retFrom = 0;
      } else if (boState === ST_INSIDE) {
        if (gt(extPos, 1.0)) {
          boState = ST_BO_UP; boPrice = chUp; boConfirm = false; boDistanced = false; boGapped = false;
          rtPrice = NaN; retFrom = 0;
        } else if (lt(extPos, 0.0)) {
          boState = ST_BO_DN; boPrice = chLo; boConfirm = false; boDistanced = false; boGapped = false;
          rtPrice = NaN; retFrom = 0;
        }
      } else if (boState === ST_BO_UP) {
        if (ge(distUp, 1.0)) boDistanced = true;
        if (lt(extPos, 0.0)) {
          boState = ST_BO_DN; boPrice = chLo; boConfirm = false; boDistanced = false; boGapped = true;
          rtPrice = NaN; retFrom = 0;
        } else if (le(extPos, 1.0)) {
          boState = ST_INSIDE; retFrom = 1; boConfirm = false; boDistanced = false; boGapped = false;
        } else if (boDistanced && lt(distUp, 1.0)) {
          boState = ST_RT_UP; rtPrice = nz(cA); boGapped = false;
        }
      } else if (boState === ST_RT_UP) {
        if (lt(extPos, 0.0)) {
          boState = ST_BO_DN; boPrice = chLo; boConfirm = false; boDistanced = false; boGapped = true;
          rtPrice = NaN; retFrom = 0;
        } else if (le(extPos, 1.0)) {
          boState = ST_INSIDE; retFrom = 1; boConfirm = false; boDistanced = false; boGapped = false;
        } else if (ge(distUp, 1.0)) {
          boState = ST_BO_UP; boConfirm = true; boDistanced = true; boGapped = false;
        }
      } else if (boState === ST_BO_DN) {
        if (ge(distDn, 1.0)) boDistanced = true;
        if (gt(extPos, 1.0)) {
          boState = ST_BO_UP; boPrice = chUp; boConfirm = false; boDistanced = false; boGapped = true;
          rtPrice = NaN; retFrom = 0;
        } else if (ge(extPos, 0.0)) {
          boState = ST_INSIDE; retFrom = -1; boConfirm = false; boDistanced = false; boGapped = false;
        } else if (boDistanced && lt(distDn, 1.0)) {
          boState = ST_RT_DN; rtPrice = nz(cA); boGapped = false;
        }
      } else if (boState === ST_RT_DN) {
        if (gt(extPos, 1.0)) {
          boState = ST_BO_UP; boPrice = chUp; boConfirm = false; boDistanced = false; boGapped = true;
          rtPrice = NaN; retFrom = 0;
        } else if (ge(extPos, 0.0)) {
          boState = ST_INSIDE; retFrom = -1; boConfirm = false; boDistanced = false; boGapped = false;
        } else if (ge(distDn, 1.0)) {
          boState = ST_BO_DN; boConfirm = true; boDistanced = true; boGapped = false;
        }
      }
    }

    angPlot.push(ang);
    agreePlot.push(cUp - cDn);
    posPlot.push(extPos * 100);
    hDir.push(dir);
    hState.push(boState);
    hConfirm.push(boConfirm);
    hGapped.push(boGapped);
    hRetFrom.push(retFrom);
    hReset.push(dirReset);
    hUp.push(cUp);
    hDn.push(cDn);
    hFlat.push(cFlat);

    const isLast = i === n - 1;
    if (i !== lastHistory && !isLast) continue;
    setDrawingBar(i, isLast, n - 1);

    // ── Visualization ──
    for (const v of [upLn, loLn, upPj, loPj, angLn, angPj]) { if (v.value) line.delete(v.value); v.value = undefined; }
    for (const v of [chFill, pjFill]) { if (v.value) linefill.delete(v.value); v.value = undefined; }
    for (const v of [lbl, mkUp, mkLo]) { if (v.value) label.delete(v.value); v.value = undefined; }
    for (const bx of blkBoxes) box.delete(bx);
    blkBoxes = [];
    for (const ln of blkHiLns) line.delete(ln);
    blkHiLns = [];
    for (const ln of blkLoLns) line.delete(ln);
    blkLoLns = [];
    for (const lb of blkGmLbs) label.delete(lb);
    blkGmLbs = [];
    for (const ln of blkGmLns) line.delete(ln);
    blkGmLns = [];

    if (cfg.showBlk && ok && blk.gm.length >= 1) {
      let pvGmY = NaN;
      let pvGmX = NaN;
      const nBlk = Math.min(groups, blk.gm.length);
      for (let g = 0; g < nBlk; g++) {
        const bOff = anchor + g * period;
        const bRight = i - bOff;
        const bLeft = bRight - period + 1;
        const bHi = blk.hi[g];
        const bLo = blk.lo[g];
        const bGm = blk.gm[g];
        const bCx = blk.cx[g];
        if (!na(bHi) && !na(bLo)) {
          const cBlk = g % 2 === 0 ? cfg.blkClr1 : cfg.blkClr2;
          blkBoxes.push(box.new(bLeft, bHi, bRight, bLo, String(color.new(cBlk, Math.max(cfg.blkTr - 25, 0))), 1,
            'dashed', undefined, undefined, String(color.new(cBlk, cfg.blkTr))));
          blkHiLns.push(line.new(bLeft, bHi, bRight, bHi, 'bar_index', 'none', String(color.new(cfg.blkHiClr, 40)),
            'dashed', 1));
          blkLoLns.push(line.new(bLeft, bLo, bRight, bLo, 'bar_index', 'none', String(color.new(cfg.blkLoClr, 40)),
            'dashed', 1));
        }
        if (!na(bGm) && !na(bCx)) {
          const gmTip = `Block ${str.tostring(g)}\nHi: ${fmt(nz(bHi))}\nLo: ${fmt(nz(bLo))}\nGM: ${fmt(bGm)}`
            + `\nBars: ${str.tostring(bLeft)}..${str.tostring(bRight)}`;
          blkGmLbs.push(label.new(bCx, bGm, '◆', 'bar_index', 'price', bgTransparent, 'label_center', cfg.blkGmClr,
            Math.max(cfg.dashSz - 2, 6), undefined, gmTip));
          if (!na(pvGmY) && !na(pvGmX)) {
            blkGmLns.push(line.new(bCx, bGm, pvGmX, pvGmY, 'bar_index', 'none', String(color.new(cfg.blkGmClr, 30)),
              'solid', 2));
          }
          pvGmY = bGm;
          pvGmX = bCx;
        }
      }
    }

    if (cfg.showCh && ok && seg >= 1 && blk.hi.length > seg) {
      const e = extremes(blk, seg);
      const sLx = blk.cx[seg];
      const sRx = blk.cx[0];
      let uY1: number, uY2: number, lY1: number, lY2: number;
      if (dir === DIR_UP) {
        uY1 = icsLine(e.fLH, e.xLH, e.fHH, e.xHH, sLx, trSig);
        uY2 = icsLine(e.fLH, e.xLH, e.fHH, e.xHH, sRx, trSig);
        lY1 = icsLine(e.fLL, e.xLL, e.fHL, e.xHL, sLx, trSig);
        lY2 = icsLine(e.fLL, e.xLL, e.fHL, e.xHL, sRx, trSig);
      } else if (dir === DIR_DOWN) {
        uY1 = icsLine(e.fHH, e.xHH, e.fLH, e.xLH, sLx, trSig);
        uY2 = icsLine(e.fHH, e.xHH, e.fLH, e.xLH, sRx, trSig);
        lY1 = icsLine(e.fHL, e.xHL, e.fLL, e.xLL, sLx, trSig);
        lY2 = icsLine(e.fHL, e.xHL, e.fLL, e.xLL, sRx, trSig);
      } else {
        uY1 = nz(e.fHH);
        uY2 = nz(e.fHH);
        lY1 = nz(e.fLL);
        lY2 = nz(e.fLL);
      }
      const chClr = dClr(dir);
      const ax = i - anchor;
      const uYa = icsLine(uY1, sLx, uY2, sRx, ax, trSig);
      const lYa = icsLine(lY1, sLx, lY2, sRx, ax, trSig);

      // Convergence clip of the solid section
      let seX = ax;
      let pjOk = true;
      if (gt(uY1, lY1) && le(uYa, lYa) && gt(trSig, MIN_SIGMA)) {
        const gsL = Math.log(uY1) / trSig - Math.log(lY1) / trSig;
        const gsR = Math.log(lYa) / trSig - Math.log(uYa) / trSig;
        const gsD = gsL + gsR;
        if (gt(gsD, 1e-10)) seX = sLx + Math.trunc(math.round(gsL / gsD * (ax - sLx)) as number);
        pjOk = false;
      }
      const uSE = icsLine(uY1, sLx, uY2, sRx, seX, trSig);
      const lSE = icsLine(lY1, sLx, lY2, sRx, seX, trSig);
      if (seX > sLx) {
        upLn.value = line.new(sLx, uY1, seX, uSE, 'bar_index', 'none', chClr, lineStyle(cfg.chSty), cfg.chW);
        loLn.value = line.new(sLx, lY1, seX, lSE, 'bar_index', 'none', chClr, lineStyle(cfg.chSty), cfg.chW);
      }

      let eX = ax + cfg.pjOff;
      let uYe = icsLine(uY1, sLx, uY2, sRx, eX, trSig);
      let lYe = icsLine(lY1, sLx, lY2, sRx, eX, trSig);
      if (pjOk) {
        // Convergence clip of the projection
        if (gt(uYa, lYa) && lt(uYe, lYe) && gt(trSig, MIN_SIGMA)) {
          const cgA = Math.log(uYa) / trSig - Math.log(lYa) / trSig;
          const cgE = Math.log(uYe) / trSig - Math.log(lYe) / trSig;
          const cgD = cgA - cgE;
          if (gt(cgD, 1e-10)) {
            eX = ax + Math.trunc(math.round(cgA / cgD * cfg.pjOff) as number);
            uYe = icsLine(uY1, sLx, uY2, sRx, eX, trSig);
            lYe = icsLine(lY1, sLx, lY2, sRx, eX, trSig);
          }
        }
        upPj.value = line.new(ax, uYa, eX, uYe, 'bar_index', 'none', chClr, lineStyle(cfg.pjSty), cfg.pjW);
        loPj.value = line.new(ax, lYa, eX, lYe, 'bar_index', 'none', chClr, lineStyle(cfg.pjSty), cfg.pjW);
      }

      if (cfg.showFill) {
        const fc = String(color.new(fClr(dir), cfg.fillTr));
        if (upLn.value && loLn.value) chFill.value = linefill.new(upLn.value, loLn.value, fc);
        if (upPj.value && loPj.value) pjFill.value = linefill.new(upPj.value, loPj.value, fc);
      }

      const extAt1 = icsPos(cA, lYa, uYa, trSig);
      const extPctTip = math.round(extAt1 * 100) as number;
      const extTipSign = gt(extPctTip, 100) ? '+' : '';
      const tip = `${L.lbl_close}[${str.tostring(anchor)}]: ${fmt(cA)}`
        + `\n${L.lbl_ceiling} ▲: ${fmt(uYa)}`
        + `\n${L.lbl_floor} ▼: ${fmt(lYa)}`
        + `\n${L.lbl_ext}: ${extTipSign}${str.tostring(extPctTip, '#')}%`;
      const mkSize = Math.max(cfg.dashSz - 4, 6);
      mkUp.value = label.new(ax, uYa, '◆', 'bar_index', 'price', bgTransparent, 'label_center', '#5b9bd5', mkSize,
        undefined, tip);
      mkLo.value = label.new(ax, lYa, '◆', 'bar_index', 'price', bgTransparent, 'label_center', '#5b9bd5', mkSize,
        undefined, tip);

      const dTxt = dStr(dir);
      const aTxt = `${ge(ang, 0) ? '+' : ''}${str.tostring(ang, '#.#')}°`;
      if (cfg.showAngLbl) {
        let lblX = Math.trunc((sLx + eX) / 2);
        let lblY = gt(uY1, 0) && gt(uYe, 0) ? Math.sqrt(uY1 * uYe) : (uY1 + uYe) / 2.0;
        if (cfg.showAng && blk.gm.length > seg && seg >= 1) {
          lblX = i - anchor + cfg.pjOff;
          lblY = icsLine(blk.gm[seg], blk.cx[seg], blk.gm[0], blk.cx[0], lblX, trSig);
        }
        lbl.value = label.new(lblX, lblY, `${dTxt} ${aTxt}`, 'bar_index', 'price', String(color.new(bgColor, 60)),
          'label_down', cfg.showAng ? cfg.angClr : chClr, Math.max(cfg.dashSz - 2, 6), undefined,
          `${L.lbl_trend_tip}: ${dTxt}\n${L.lbl_angle}: ${aTxt}\n${L.lbl_blocks}: ${str.tostring(seg + 1)}`);
      }
    }

    // Angle line: solid from the oldest to the newest segment mean, dotted projection
    if (cfg.showAng && ok && seg >= 1 && blk.gm.length > seg) {
      const aGmOld = blk.gm[seg];
      const aGmNew = blk.gm[0];
      const aCxOld = blk.cx[seg];
      const aCxNew = blk.cx[0];
      angLn.value = line.new(aCxOld, aGmOld, aCxNew, aGmNew, 'bar_index', 'none', cfg.angClr, 'solid', 2);
      const aPjX = i - anchor + cfg.pjOff;
      const aPjY = icsLine(aGmOld, aCxOld, aGmNew, aCxNew, aPjX, trSig);
      angPj.value = line.new(aCxNew, aGmNew, aPjX, aPjY, 'bar_index', 'none', cfg.angClr, 'dotted', 2);
    }

    // ── Dashboard ──
    if (dash) {
      table.delete(dash);
      dash = undefined;
    }
    if (cfg.showDash) {
      const sz = Math.max(cfg.dashSz, 6);
      const szSm = Math.max(sz - 2, 6);
      const szXs = Math.max(sz - 4, 6);
      const bg = String(color.new(bgColor, 20));
      const bgHd = String(color.new(bgColor, 10));
      const bdr = String(color.new(fgColor, 85));
      const fg = fgColor;
      const fg2 = String(color.new(fgColor, 40));
      const EMPTY_TEXT = '#363A45';
      const t = table.new(POSITIONS[cfg.dashPos] ?? 'top_right', 7, 5, bg, bdr, 1, bdr, 1);
      dash = t;

      table.cell(t, 0, 0, `ST-EP06 · #${tickerOf(chart)} · ${tf}${tfS}     ${fmt(C[i])} ${currencyOf(chart)}`, 0, 0,
        fg, 'left', undefined, szSm, bgHd, L.tip_header);
      for (let c = 1; c <= 6; c++) table.cell(t, c, 0, '', 0, 0, EMPTY_TEXT, undefined, undefined, undefined, bgHd);
      table.merge_cells(t, 0, 0, 6, 0);

      table.cell(t, 0, 1, L.lbl_period, 0, 0, fg2, 'left', undefined, szXs, bg, L.tip_period);
      for (let c = 0; c <= 5; c++) {
        table.cell(t, c + 1, 1, str.tostring(SCALES[c]), 0, 0, '#5b9bd5', 'center', undefined, szXs, bg);
      }

      table.cell(t, 0, 2, L.lbl_trend, 0, 0, fg2, 'left', undefined, szXs, bg, L.tip_trend);
      for (let c = 0; c <= 5; c++) {
        const tr = trends[c];
        table.cell(t, c + 1, 2, dStr(tr.dir), 0, 0, dClr(tr.dir), 'center', undefined, szXs, bg);
      }

      const chUpStr = !na(chUp) ? fmt(chUp) : '—';
      const chLoStr = !na(chLo) ? fmt(chLo) : '—';
      const agCnt = cUp > cDn ? cUp : cDn > cUp ? cDn : cFlat;
      const agDir = cUp > cDn ? L.dir_up : cDn > cUp ? L.dir_dn : L.dir_rng;
      table.cell(t, 0, 3, `${L.lbl_agreement}: ${str.tostring(agCnt)}/6 ${agDir}  ▲ ${chUpStr}  ▼ ${chLoStr}`, 0, 0,
        fg2, 'left', undefined, szXs, bg, L.tip_agreement);
      for (let c = 1; c <= 6; c++) table.cell(t, c, 3, '', 0, 0, EMPTY_TEXT, undefined, undefined, undefined, bg);
      table.merge_cells(t, 0, 3, 6, 3);

      // Row 4: breakout / retest narrative
      let stLine1 = '';
      let stLine2 = '';
      let stClr = String(color.new('#888888', 0));
      const flPct = math.round(Math.max(0.0, Math.min(extPos, 1.0)) * 100) as number;
      const clPct = 100.0 - flPct;
      const abPct = math.round((extPos - 1.0) * 100) as number;
      const blPct = math.round(Math.abs(Math.min(extPos, 0.0)) * 100) as number;
      if (boState === ST_BO_UP) {
        stClr = cfg.clrUp;
        stLine1 = `${L.st_bo_up}${boConfirm ? ' ✓' : ''}${boGapped ? ` ${L.conn_gap}` : ''} ${L.conn_at} ${fmt(nz(boPrice))}`;
        if (boConfirm && !na(rtPrice)) stLine1 = `${stLine1} ${L.conn_retested} ${fmt(nz(rtPrice))}`;
        stLine2 = `${str.tostring(abPct, '#')}${L.dist_above_ceiling}`;
      } else if (boState === ST_RT_UP) {
        stClr = String(color.new('#EF9F27', 0));
        stLine1 = `${L.st_rt_up_broke_at} ${fmt(nz(boPrice))}`;
        stLine2 = `${L.conn_now} ${fmt(nz(cA))} · ${str.tostring(abPct, '#')}${L.dist_above_ceiling}`;
      } else if (boState === ST_BO_DN) {
        stClr = cfg.clrDn;
        stLine1 = `${L.st_bo_dn}${boConfirm ? ' ✓' : ''}${boGapped ? ` ${L.conn_gap}` : ''} ${L.conn_at} ${fmt(nz(boPrice))}`;
        if (boConfirm && !na(rtPrice)) stLine1 = `${stLine1} ${L.conn_retested} ${fmt(nz(rtPrice))}`;
        stLine2 = `${str.tostring(blPct, '#')}${L.dist_below_floor}`;
      } else if (boState === ST_RT_DN) {
        stClr = String(color.new('#EF9F27', 0));
        stLine1 = `${L.st_rt_dn_broke_at} ${fmt(nz(boPrice))}`;
        stLine2 = `${L.conn_now} ${fmt(nz(cA))} · ${str.tostring(blPct, '#')}${L.dist_below_floor}`;
      } else {
        stClr = retFrom !== 0 || dirReset ? String(color.new('#5b9bd5', 0)) : String(color.new('#888888', 0));
        stLine1 = dirReset ? L.st_inside_dir_ch : retFrom === 1 ? L.st_inside_fail_up
          : retFrom === -1 ? L.st_inside_fail_dn : L.st_inside;
        stLine2 = `${str.tostring(flPct, '#')}${L.dist_from_floor} · ${str.tostring(clPct, '#')}${L.dist_to_ceiling}`;
      }
      table.cell(t, 0, 4, `${stLine1} · ${stLine2}`, 0, 0, stClr, 'left', undefined, szXs, bg, L.tip_narrative);
      for (let c = 1; c <= 6; c++) table.cell(t, c, 4, '', 0, 0, EMPTY_TEXT, undefined, undefined, undefined, bg);
      table.merge_cells(t, 0, 4, 6, 4);
    }

    // Warning label: alerts on with "Close Bar" (barstate.islast)
    if (isLast) {
      if (alertWarn.value) label.delete(alertWarn.value);
      alertWarn.value = undefined;
      if (cfg.enableAlerts && anchor !== 0) {
        alertWarn.value = label.new(i, H[i], `⚠  ${L.alert_warn}`, 'bar_index', 'abovebar',
          String(color.new('#EF9F27', 0)), 'label_down', '#FFFFFF', Math.max(cfg.dashSz, 6), undefined,
          L.alert_warn_tip);
      }
    }
  }
  setDrawingBar(null);

  // Alert conditions (x[1] of an int is na on bar 0: a comparison with it is false)
  const active = cfg.enableAlerts && anchor === 0;
  const flags: boolean[][] = alertConditions.map(() => []);
  for (let i = 0; i < n; i++) {
    const p = i > 0;
    const f = [
      hDir[i] === DIR_UP && p && hDir[i - 1] !== DIR_UP,
      hDir[i] === DIR_DOWN && p && hDir[i - 1] !== DIR_DOWN,
      hDir[i] === DIR_FLAT && p && hDir[i - 1] !== DIR_FLAT,
      hState[i] === ST_BO_UP && p && hState[i - 1] !== ST_BO_UP,
      hConfirm[i] && !(p && hConfirm[i - 1]) && hState[i] === ST_BO_UP,
      hState[i] === ST_BO_DN && p && hState[i - 1] !== ST_BO_DN,
      hConfirm[i] && !(p && hConfirm[i - 1]) && hState[i] === ST_BO_DN,
      hState[i] === ST_RT_UP && p && hState[i - 1] !== ST_RT_UP,
      hState[i] === ST_RT_DN && p && hState[i - 1] !== ST_RT_DN,
      hGapped[i] && !(p && hGapped[i - 1]) && hState[i] === ST_BO_UP,
      hGapped[i] && !(p && hGapped[i - 1]) && hState[i] === ST_BO_DN,
      hRetFrom[i] === 1 && p && hRetFrom[i - 1] !== 1,
      hRetFrom[i] === -1 && p && hRetFrom[i - 1] !== -1,
      hReset[i],
      hUp[i] === 6 && p && hUp[i - 1] !== 6,
      hUp[i] === 5 && p && hUp[i - 1] !== 5,
      hDn[i] === 6 && p && hDn[i - 1] !== 6,
      hDn[i] === 5 && p && hDn[i - 1] !== 5,
      hFlat[i] >= 4 && p && hFlat[i - 1] < 4,
    ];
    f.forEach((v, j) => flags[j].push(active && v));
  }

  const plot = (vals: number[]) => vals.map((v, i) => ({ time: bars[i].time, value: na(v) ? NaN : v }));
  const out = drawingOutputs(bars);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: plot(angPlot), plot1: plot(agreePlot), plot2: plot(posPlot) },
    lines: out.lines ?? [],
    linefills: out.linefills ?? [],
    labels: out.labels ?? [],
    boxes: out.boxes ?? [],
    tables: out.tables ?? [],
    alerts: alertStates(alertConditions, bars, flags),
  };
}

export const SmartTraderEpisode06IsotropicTrendLines = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, alertConditions, drawingKinds,
};
