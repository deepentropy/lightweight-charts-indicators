//FUNCTIONS
RoundUp(number, decimals) =>
    factor = math.pow(10, decimals)
    math.ceil(number * factor) / factor
calc_rr(float entry_price, float sl_price, float take_price) => 
    entry_price > sl_price ? (take_price - entry_price) / (entry_price - sl_price) : (entry_price - take_price) / (sl_price - entry_price)

create_trend_line(float sensitivity, float fib) =>
    high_line = ta.highest(high, int(sensitivity))
	low_line = ta.lowest(low, int(sensitivity))
	channel_range = high_line - low_line
	high_line - channel_range * fib
//FUNCTIONS
// TYPES AND METHODS
type Strategy_settings
	float sensitivity = 0
	float risk_percent = 1
	string break_even_target = "1"
	float tp1_percent = 0
	float tp1_percent_fix = 0
	float tp2_percent = 0
	float tp2_percent_fix = 0
	float tp3_percent = 0
	float tp3_percent_fix = 0
	float tp4_percent = 0
	float tp4_percent_fix = 0
	bool fixed_stop = false
	float sl_percent = 0

type Trade
    int start_bar_index = 0
    string side
    float market_order_comission
    float limit_order_comission
    float entry_price
    bool entry_hit = false
    float sl_price
    float tp1_price
	float tp1_percent_fix
    float tp2_price
	float tp2_percent_fix
    float tp3_price
	float tp3_percent_fix
    float tp4_price
	float tp4_percent_fix
    float break_even_price
    bool sl_hit = false
    bool tp1_hit = false
    bool tp2_hit = false
    bool tp3_hit = false
    bool tp4_hit = false
    float position_size_left = 100
	float risk_percent
    bool is_closed = false
    float close_price = 0
    bool can_break_even = false
    bool force_closed = false
    float profit = 0
    float risk_reward
    line entry_line
    line stoploss_line
    line target1_line
    line target2_line
    line target3_line
    line target4_line

method calc_profit(Trade trade, bool show_labels) =>
    label trade_info_label = na
    label entry_hit_label = na
	label tp1_hit_label = na
	label tp2_hit_label = na
	label tp3_hit_label = na
	label tp4_hit_label = na
	label sl_hit_label = na
	label be_hit_label = na
	float profit = 0.0
	if trade.side == "LONG"
        if low <= trade.entry_price and not trade.entry_hit
            trade.start_bar_index := bar_index
            trade.entry_hit := true
            entry_hit_label := label.new(trade.start_bar_index, trade.entry_price, str.tostring("ENTRY HIT"), style = label.style_label_right)
            trade_info_label := label.new(bar_index, high, "Trade info:" + "\nEntry: " + str.tostring(trade.entry_price) + "\nTp1: " + str.tostring(trade.tp1_price) + "\nTp2: " + str.tostring(trade.tp2_price) + "\nTp3:" +  str.tostring(trade.tp3_price) + "\nTp4: " + str.tostring(trade.tp4_price) + "\nSl: " + str.tostring(trade.sl_price))
        if high >= trade.tp1_price and not trade.tp1_hit and trade.entry_hit
            trade.tp1_hit := true
            trade.position_size_left -= trade.tp1_percent_fix
            profit += calc_rr(trade.entry_price, trade.sl_price, trade.tp1_price) * trade.tp1_percent_fix / 100 * trade.risk_percent
            tp1_hit_label := label.new(trade.start_bar_index, trade.tp1_price, str.tostring("TP1 HIT +") + str.tostring(profit, "#.##") + "%" + "\nPosition size %: " + str.tostring(trade.position_size_left), style = label.style_label_right)
        if high >= trade.tp2_price and not trade.tp2_hit and trade.entry_hit
            trade.tp2_hit := true
            trade.can_break_even := true
            trade.position_size_left -= trade.tp2_percent_fix
            profit += calc_rr(trade.entry_price, trade.sl_price, trade.tp2_price) * trade.tp2_percent_fix / 100 * trade.risk_percent
            tp2_hit_label := label.new(trade.start_bar_index, trade.tp2_price, str.tostring("TP2 HIT +") + str.tostring(profit, "#.##") + "%" + "\nPosition size %: " + str.tostring(trade.position_size_left), style = label.style_label_right)
        if high >= trade.tp3_price and not trade.tp3_hit and trade.entry_hit
            trade.tp3_hit := true
            trade.position_size_left -= trade.tp3_percent_fix
            profit += calc_rr(trade.entry_price, trade.sl_price, trade.tp3_price) * trade.tp3_percent_fix / 100 * trade.risk_percent
            tp3_hit_label := label.new(trade.start_bar_index, trade.tp3_price, str.tostring("TP3 HIT +") + str.tostring(profit, "#.##") + "%" + "\nPosition size %: " + str.tostring(trade.position_size_left), style = label.style_label_right)
        if high >= trade.tp4_price and not trade.tp4_hit and trade.entry_hit
            trade.tp4_hit := true
            trade.is_closed := true
            trade.position_size_left -= trade.tp4_percent_fix
            profit += calc_rr(trade.entry_price, trade.sl_price, trade.tp4_price) * trade.tp4_percent_fix / 100 * trade.risk_percent
            tp4_hit_label := label.new(trade.start_bar_index, trade.tp4_price, str.tostring("TP4 HIT +") + str.tostring(profit, "#.##") + "%" + "\nPosition size %: " + str.tostring(trade.position_size_left), style = label.style_label_right)
        if high >= trade.break_even_price and not trade.can_break_even and trade.entry_hit
            trade.can_break_even := true
        //BE ENTRY HIT
        if trade.can_break_even and trade.entry_hit
            if low <= trade.entry_price and not (close >= open) and bar_index != trade.start_bar_index
                trade.is_closed := true
                be_hit_label := label.new(bar_index, trade.entry_price, str.tostring("BE HIT"), style = label.style_label_left)
        // SL HIT
        if low <= trade.sl_price and not trade.can_break_even and trade.entry_hit and bar_index != trade.start_bar_index
            trade.sl_hit := true
            trade.is_closed := true
            profit += -trade.risk_percent * trade.position_size_left / 100
            sl_hit_label := label.new(bar_index, trade.sl_price, str.tostring("SL HIT ") + str.tostring(profit, "#.##") + "%", color = color.red, style = label.style_label_left)
    else
        if high >= trade.entry_price and not trade.entry_hit
            trade.start_bar_index := bar_index
            trade.entry_hit := true
            entry_hit_label := label.new(trade.start_bar_index, trade.entry_price, str.tostring("ENTRY HIT"), style = label.style_label_right)
            trade_info_label := label.new(bar_index, high, "Trade info:" + "\nEntry: " + str.tostring(trade.entry_price) + "\nTp1: " + str.tostring(trade.tp1_price) + "\nTp2: " + str.tostring(trade.tp2_price) + "\nTp3:" +  str.tostring(trade.tp3_price) + "\nTp4: " + str.tostring(trade.tp4_price) + "\nSl: " + str.tostring(trade.sl_price))
        if low <= trade.tp1_price and not trade.tp1_hit and trade.entry_hit
            trade.tp1_hit := true
            trade.position_size_left -= trade.tp1_percent_fix
            profit += calc_rr(trade.entry_price, trade.sl_price, trade.tp1_price) * trade.tp1_percent_fix / 100 * trade.risk_percent
            tp1_hit_label := label.new(trade.start_bar_index, trade.tp1_price, str.tostring("TP1 HIT +") + str.tostring(profit, "#.##") + "%" + "\nPosition size %: " + str.tostring(trade.position_size_left), style = label.style_label_right)
        if low <= trade.tp2_price and not trade.tp2_hit and trade.entry_hit
            trade.tp2_hit := true
            trade.position_size_left -= trade.tp2_percent_fix
            profit += calc_rr(trade.entry_price, trade.sl_price, trade.tp2_price) * trade.tp2_percent_fix / 100 * trade.risk_percent
            tp2_hit_label := label.new(trade.start_bar_index, trade.tp2_price, str.tostring("TP2 HIT +") + str.tostring(profit, "#.##") + "%" + "\nPosition size %: " + str.tostring(trade.position_size_left), style = label.style_label_right)
        if low <= trade.tp3_price and not trade.tp3_hit and trade.entry_hit
            trade.tp3_hit := true
            trade.position_size_left -= trade.tp3_percent_fix
            profit += calc_rr(trade.entry_price, trade.sl_price, trade.tp3_price) * trade.tp3_percent_fix / 100 * trade.risk_percent
            tp3_hit_label := label.new(trade.start_bar_index, trade.tp3_price, str.tostring("TP3 HIT +") + str.tostring(profit, "#.##") + "%" + "\nPosition size %: " + str.tostring(trade.position_size_left), style = label.style_label_right)
        if low <= trade.tp4_price and not trade.tp4_hit and trade.entry_hit
            trade.tp4_hit := true
            trade.is_closed := true
            trade.position_size_left -= trade.tp4_percent_fix
            profit += calc_rr(trade.entry_price, trade.sl_price, trade.tp4_price) * trade.tp4_percent_fix / 100  * trade.risk_percent
            tp4_hit_label := label.new(trade.start_bar_index, trade.tp4_price, str.tostring("TP4 HIT +") + str.tostring(profit, "#.##") + "%" + "\nPosition size %: " + str.tostring(trade.position_size_left), style = label.style_label_right)
        if low <= trade.break_even_price and not trade.can_break_even and trade.entry_hit
            trade.can_break_even := true
        //BE ENTRY HIT
        if trade.can_break_even and trade.entry_hit
            if high >= trade.entry_price and not (close <= open) and bar_index != trade.start_bar_index
                trade.is_closed := true
                be_hit_label := label.new(bar_index, trade.entry_price, str.tostring("BE HIT"), style = label.style_label_left)
        // SL HIT
        if high >= trade.sl_price and not trade.can_break_even and trade.entry_hit and bar_index != trade.start_bar_index
            trade.sl_hit := true
            trade.is_closed := true
            profit += -trade.risk_percent * trade.position_size_left / 100
            sl_hit_label := label.new(bar_index, trade.sl_price, str.tostring("SL HIT ") + str.tostring(profit, "#.##") + "%", color = color.red, style = label.style_label_left)
    trade.profit += profit
	if not show_labels
        label.delete(entry_hit_label)
		label.delete(tp1_hit_label)
		label.delete(tp2_hit_label)
		label.delete(tp3_hit_label)
		label.delete(tp4_hit_label)
		label.delete(sl_hit_label)
		label.delete(be_hit_label)
        label.delete(trade_info_label)

method close_trade(Trade trade, bool show_labels) =>
    float profit = 0.0
    label trade_closed_label = na
    trade.force_closed := true
    if not trade.sl_hit
        if trade.side == "SHORT"
            trade.is_closed := true
            trade.close_price := close
            if close <= trade.entry_price
                percent_from_entry_to_close_price_at_trend_change =  math.abs((close / trade.entry_price) * 100)
                percent_from_entry_to_sl_price = math.abs((trade.entry_price / trade.sl_price) * 100)
                profit := calc_rr(trade.entry_price, trade.sl_price, close) * trade.position_size_left / 100 * trade.risk_percent
            else
                profit := calc_rr(trade.entry_price, trade.sl_price, close) * trade.position_size_left / 100 * trade.risk_percent
            string sign = profit >= 0 ? "+" : na
            trade_closed_label := label.new(bar_index, high, str.tostring("TRADE CLOSED ") + sign + str.tostring(profit, "#.##") + "%")
        else
            trade.is_closed := true
            trade.close_price := close
            if close <= trade.entry_price
                percent_from_entry_to_close_price_at_trend_change =  math.abs((close / trade.entry_price - 1) * 100)
                percent_from_entry_to_sl_price = math.abs((trade.entry_price / trade.sl_price - 1) * 100)
                profit := -trade.risk_percent * (percent_from_entry_to_close_price_at_trend_change / percent_from_entry_to_sl_price) * trade.position_size_left / 100 + trade.profit
            else
                profit := calc_rr(trade.entry_price, trade.sl_price, close) * trade.position_size_left / 100 * trade.risk_percent
            string sign = profit >= 0 ? "+" : na
            trade_closed_label := label.new(bar_index, low, str.tostring("TRADE CLOSED ") + sign + str.tostring(profit, "#.##") + "%", style = label.style_label_up)
    if not show_labels
        label.delete(trade_closed_label)
    trade.profit += profit
// TYPES AND METHODS

// STRATS
selector(string strategy_name) =>
	strategy_settings = Strategy_settings.new()
	switch strategy_name
		"MANUAL" =>
			strategy_settings.sensitivity := 18
			strategy_settings.risk_percent := 1
			strategy_settings.break_even_target := "1"
			strategy_settings.tp1_percent := 1
			strategy_settings.tp1_percent_fix := 40
			strategy_settings.tp2_percent := 2
			strategy_settings.tp2_percent_fix := 30
			strategy_settings.tp3_percent := 3
			strategy_settings.tp3_percent_fix := 20
			strategy_settings.tp4_percent := 4
			strategy_settings.tp4_percent_fix := 10
			strategy_settings.fixed_stop := false
			strategy_settings.sl_percent := 0.0
		"UNIVERSAL 15m" => 
			strategy_settings.sensitivity := 20
			strategy_settings.risk_percent := 1
			strategy_settings.break_even_target := "1"
			strategy_settings.tp1_percent := 1
			strategy_settings.tp1_percent_fix := 40
			strategy_settings.tp2_percent := 2
			strategy_settings.tp2_percent_fix := 30
			strategy_settings.tp3_percent := 3
			strategy_settings.tp3_percent_fix := 20
			strategy_settings.tp4_percent := 4
			strategy_settings.tp4_percent_fix := 10
			strategy_settings.fixed_stop := false
			strategy_settings.sl_percent := 0.0
		"SOL 5m" => 
			strategy_settings.sensitivity := 20
			strategy_settings.risk_percent := 1
			strategy_settings.break_even_target := "1"
			strategy_settings.tp1_percent := 1
			strategy_settings.tp1_percent_fix := 40
			strategy_settings.tp2_percent := 2
			strategy_settings.tp2_percent_fix := 30
			strategy_settings.tp3_percent := 3
			strategy_settings.tp3_percent_fix := 20
			strategy_settings.tp4_percent := 4
			strategy_settings.tp4_percent_fix := 10
			strategy_settings.fixed_stop := false
			strategy_settings.sl_percent := 0.0
	strategy_settings
// STRATS

string STRATEGIES = "STRATEGIES"
string POSITION = "POSITION"
string ENTRY = "ENTRY"
string TAKE_PROFITS = "TAKE PROFITS"
string STOP_LOSS = "STOPLOSS"
string rsi_group = "RSI"
string main_group = "MAIN"
string info_panel_group = "INFOPANELS"
string dev_settings = "DEVELOPER MODE"

int fibo_lines_transparend = 60
int fill_best_transparend = 95
int fill_worst_transparend = 98

color high_line_color = color.rgb(36, 255, 44, fibo_lines_transparend)
color fib_236_color = color.rgb(130, 228, 74, fibo_lines_transparend)
color fib_382_color = color.rgb(171, 224, 174, fibo_lines_transparend)
color fib_618_color = color.rgb(235, 255, 51, fibo_lines_transparend)
color fib_786_color = color.rgb(255, 131, 73, fibo_lines_transparend)
color low_line_color = color.rgb(255, 82, 82, fibo_lines_transparend)

color high_best_fill_color = color.rgb(48, 255, 55, fill_best_transparend)
color high_worst_fill_color = color.rgb(37, 255, 44, fill_worst_transparend)
color low_best_fill_color = color.rgb(255, 54, 54, fill_best_transparend)
color low_worst_fill_color = color.rgb(255, 43, 43, fill_worst_transparend)

tp_sl_entry_transparent = 30
color tp_color = color.new(color.green, tp_sl_entry_transparent)
color entry_color = color.rgb(120, 123, 134, tp_sl_entry_transparent)
color sl_color = color.new(color.red, tp_sl_entry_transparent)
line_style = line.style_dotted


//@version=5
indicator(title='[IMBA] ALGO', shorttitle='[IMBA] ALGO', overlay=true, max_lines_count = 500, max_labels_count = 500, max_bars_back = 1)

//---------------------------------------------------SETTINGS----------------------------------------------------------\\
// STRATS
var float sensitivity = 18
float risk_percent = 1
string break_even_target = "2"
float tp1_percent = 0
float tp1_percent_fix = 0
float tp2_percent = 0
float tp2_percent_fix = 0
float tp3_percent = 0
float tp3_percent_fix = 0
float tp4_percent = 0
float tp4_percent_fix = 0
bool fixed_stop = false
float sl_percent = 0

strategy_input = input.string(title = "STRATEGY", options = [
     "MANUAL",
     "UNIVERSAL 15m",
     "===============",
     "-------A-------",
     "-------B-------",
     "-------C-------",
     "-------D-------",
     "-------E-------",
     "-------F-------",
     "-------G-------",
     "-------H-------",
     "-------I-------",
     "-------J-------",
     "-------K-------",
     "-------L-------",
     "-------M-------",
     "-------N-------",
     "-------O-------",
     "-------P-------",
     "-------Q-------",
     "-------R-------",
     "-------S-------",
     "SOL 5m",
     "-------T-------",
     "-------U-------",
     "-------V-------",
     "-------W-------",
     "-------X-------",
     "-------Y-------",
     "-------Z-------"
     ], defval = "MANUAL", tooltip = "EN:\nTo manually configure the strategy, select MANUAL otherwise, changing the settings won't have any effect\nRU:\nЧтобы настроить стратегию вручную, выберите MANUAL в противном случае изменение настроек не будет иметь никакого эффекта")

// MAIN
sensitivity_input = input.float(title = 'Sensitive', step = 0.1, defval = 18)
start_date_input = input.time(defval = timestamp("1 June 2023"), title = "Start calculating date")
// POSITION
show_tp_enty_sl = input.bool(defval = true, title = "Show", group = POSITION, inline = "2.1")
fill_positions = input.bool(defval = true, title = "Fill", group = POSITION, inline = "2.1")
risk_percent_input = input.float(title = "Risk %", step = 1, defval = 1, group = POSITION, tooltip = "EN:\nMaximum allowable loss % of the deposit per 1 trade\nRU:\nМаксимально допустимая потеря % от депозита на 1 сделку")
break_even_target_input = input.string(title = "BE target", options = ["WITHOUT","1","2","3"], defval = "1", group = POSITION)
initial_deposit_input = input.float(title = "Initial deposit", defval = 1000, step = 100, group = POSITION)
// STOPLOSS
fixed_stop_input = input.bool(defval = false, title = "Fixed stoploss %", group = STOP_LOSS, tooltip = "EN:\nIf choosed: stoploss will be calculated manually \nIf NOT choosed: stoploss will be calculated automatic\nRU:\nЕсли выбрано: стоп будет рассчитываться вручную \nЕсли НЕ выбрано: стоп будет рассчитываться автоматически")
sl_percent_input = input.float(title="SL %", step = 0.1, defval=0.00, group = STOP_LOSS)
// TAKE PROFITS
tp1_percent_input = input.float(title="TP 1", step = 0.05, defval=1.00, minval = 0, group = TAKE_PROFITS, inline = "2.2")
tp1_percent_fix_input = input.float(title = "Fix %", step = 5, defval=40, group = TAKE_PROFITS, inline = "2.2")
tp2_percent_input = input.float(title="TP 2", step = 0.05, defval=2.00, minval = 0, group = TAKE_PROFITS, inline = "2.3")
tp2_percent_fix_input = input.float(title = "Fix %", step = 5, defval=30, group = TAKE_PROFITS, inline = "2.3")
tp3_percent_input = input.float(title="TP 3", step = 0.05, defval=3.00, minval = 0, group = TAKE_PROFITS, inline = "2.4")
tp3_percent_fix_input = input.float(title = "Fix %", step = 5, defval=20, group = TAKE_PROFITS, inline = "2.4")
tp4_percent_input = input.float(title="TP 4", step = 0.05, defval=4.00, minval = 0, group = TAKE_PROFITS, inline = "2.5")
tp4_percent_fix_input = input.float(title = "Fix %", step = 5, defval=10, group = TAKE_PROFITS, inline = "2.5")

// RSI
show_rsi = input.bool(defval = false, title = "Show", group = rsi_group, inline = "3.1")
len = input(title="Length", defval=14, group = rsi_group, inline = "3.2")
overbought = input(title="Overbought", defval=78, group = rsi_group, inline = "3.3")
oversold = input(title="Oversold", defval=22, group = rsi_group, inline = "3.3")
// INFO PANEL
show_profit_panel = input.bool(defval = true, title = "Show profit panel", group = info_panel_group)
show_strategy_panel = input.bool(defval = false, title = "Show strategy panel", group = info_panel_group)
show_old_panel = input.bool(defval = false, title = "Show old panel", group = info_panel_group)
// DEV
show_dev_labels = input.bool(defval = false, title = "Show", group = dev_settings, tooltip = "Shows all possible events")

//-----------------------------------------------GLOBAL VARIABLES------------------------------------------------------\\
var float total_profit = 0.0
var int trade_count = 0
var int profit_trades = 0
var int loss_trades = 0
var int loss_streak = 0
var int loss_in_a_row = 0
var int win_streak = 0
var int wins_in_a_row = 0
var int first_trade_date = na
var Trade trade = na
var bool is_long_trend_started = false
var bool is_short_trend_started = false
var bool is_trend_change = na
var bool is_long_trend = false
var bool is_short_trend = false
var bool can_long = false
var bool can_short = false

var int trend_started_bar_index = na
var line tp1_line = na
var label tp1_label = na
var line tp2_line = na
var label tp2_label = na
var line tp3_line = na
var label tp3_label = na
var line tp4_line = na
var label tp4_label = na
var line entry_line = na
var label entry_label = na
var line close_line = na
var line sl_line = na
var label sl_label = na
var label lable_at_signal = na
var int signal_closed_bar = na
var Strategy_settings strategy_s = na
var float dep = initial_deposit_input
//-----------------------------------------------------MAIN------------------------------------------------------------\\
// STRATEGY

strategy_s := strategy_input == "MANUAL" ? Strategy_settings.new(sensitivity_input, risk_percent_input, break_even_target_input, tp1_percent_input, tp1_percent_fix_input, tp2_percent_input, tp2_percent_fix_input, tp3_percent_input, tp3_percent_fix_input, tp4_percent_input, tp4_percent_fix_input, fixed_stop_input, sl_percent_input) : selector(strategy_input)

sensitivity := strategy_s.sensitivity
risk_percent := strategy_s.risk_percent
break_even_target := strategy_s.break_even_target
tp1_percent := strategy_s.tp1_percent
tp1_percent_fix := strategy_s.tp1_percent_fix
tp2_percent := strategy_s.tp2_percent
tp2_percent_fix := strategy_s.tp2_percent_fix
tp3_percent := strategy_s.tp3_percent
tp3_percent_fix := strategy_s.tp3_percent_fix
tp4_percent := strategy_s.tp4_percent
tp4_percent_fix := strategy_s.tp4_percent_fix
fixed_stop := strategy_s.fixed_stop
sl_percent := strategy_s.sl_percent

sensitivity *= 10
tp1_percent /= 100
tp2_percent /= 100
tp3_percent /= 100
tp4_percent /= 100
tp1_percent_fix /= 100
tp2_percent_fix /= 100
tp3_percent_fix /= 100
tp4_percent_fix /= 100
sl_percent /= 100


high_line = ta.highest(high, int(sensitivity))
low_line = ta.lowest(low, int(sensitivity))
channel_range = high_line - low_line
fib_236 = high_line - channel_range * (0.236)
fib_382 = high_line - channel_range * 0.382
fib_5 = high_line - channel_range * 0.5
fib_618 = high_line - channel_range * 0.618
fib_786 = high_line - channel_range * (0.786)
imba_trend_line = fib_5

// CAN LONG/SHORT
if time >= start_date_input
    can_long := close >= imba_trend_line and close >= fib_236 and not is_long_trend
    can_short := close <= imba_trend_line and close <= fib_786 and not is_short_trend

if can_long
    is_long_trend := true
    is_short_trend := false
    is_long_trend_started := is_long_trend_started ? false : true
else if can_short
    is_short_trend := true
    is_long_trend := false
    is_short_trend_started := is_short_trend_started ? false : true
else
    is_trend_change := false
    can_long := false
    can_short := false
    is_short_trend_started := false
    is_long_trend_started := false

is_trend_change := is_short_trend_started or is_long_trend_started
plotshape(is_long_trend and is_long_trend_started ? imba_trend_line : na, title="Long", style=shape.triangleup, location=location.belowbar, color=color.green, size=size.small)
plotshape(is_short_trend and is_short_trend_started ? imba_trend_line : na, title="Short", style=shape.triangledown, location=location.abovebar, color=color.red, size=size.small)
plot(imba_trend_line, color = is_long_trend[1] ? color.green : color.red, linewidth = 3)

// LOGIC
if not na(trade)
    calc_profit(trade, show_dev_labels)
    if is_trend_change and not trade.is_closed
        close_trade(trade, show_dev_labels)
    if not trade.is_closed
        label.set_x(entry_label, bar_index - 3)
        label.set_text(entry_label, str.tostring(trade.side == "LONG" ? "🔰" : "🔰")  + str.tostring(trade.entry_price))
        label.set_x(sl_label, bar_index - 3)
        label.set_text(sl_label, "⛔" + str.tostring(trade.sl_price))
        label.set_x(tp1_label, bar_index - 3)
        label.set_text(tp1_label, str.tostring(trade.tp1_hit ? "✅" : "1️⃣") + str.tostring(trade.tp1_price))
        label.set_x(tp2_label, bar_index - 3)
        label.set_text(tp2_label, str.tostring(trade.tp2_hit ? "✅" : "2️⃣") + str.tostring(trade.tp2_price))
        label.set_x(tp3_label, bar_index - 3)
        label.set_text(tp3_label, str.tostring(trade.tp3_hit ? "✅" : "3️⃣") + str.tostring(trade.tp3_price))
        label.set_x(tp4_label, bar_index - 3)
        label.set_text(tp4_label, str.tostring(trade.tp4_hit ? "✅" : "4️⃣") + str.tostring(trade.tp4_price))
        line.set_xy1(tp1_line, trade.start_bar_index, trade.tp1_price)
        line.set_xy2(tp1_line, bar_index + 1, trade.tp1_price)
        line.set_xy1(tp2_line, trade.start_bar_index, trade.tp2_price)
        line.set_xy2(tp2_line, bar_index + 1, trade.tp2_price)
        line.set_xy1(tp3_line, trade.start_bar_index, trade.tp3_price)
        line.set_xy2(tp3_line, bar_index + 1, trade.tp3_price)
        line.set_xy1(tp4_line, trade.start_bar_index, trade.tp4_price)
        line.set_xy2(tp4_line, bar_index + 1, trade.tp4_price)
        line.set_xy1(entry_line, trade.start_bar_index, trade.entry_price)
        line.set_xy2(entry_line, bar_index + 1, trade.entry_price)
        line.set_xy1(sl_line, trade.start_bar_index, trade.sl_price)
        line.set_xy2(sl_line, bar_index + 1, trade.sl_price)
        
    lable_at_signal.set_x(int(math.avg(bar_index, trade.start_bar_index)))
    sign = trade.profit >= 0 ? "+" : na
    lable_at_signal.set_text(sign + str.tostring(trade.profit, "#.##") + "%")
    lable_at_signal.set_color(trade.profit >= 0 ? color.green : color.red)

    // FILLING
    if fill_positions
        if trade.tp1_hit
            linefill.new(entry_line, tp1_line, color = color.new(color.green, 85))
        if trade.tp2_hit
            linefill.new(tp1_line, tp2_line, color = color.new(color.green, 85))
        if trade.tp3_hit
            linefill.new(tp2_line, tp3_line, color = color.new(color.green, 85))
        if trade.tp4_hit
            linefill.new(tp3_line, tp4_line, color = color.new(color.green, 85))
        if trade.sl_hit
            linefill.new(sl_line, entry_line, color = color.new(color.red, 85))
        if trade.force_closed
            close_line := line.new(x1=trade.start_bar_index, y1=trade.close_price, x2=bar_index, y2=trade.close_price, color=color.white, style = line_style, width = 2)
            if trade.profit <= 0
                linefill.new(close_line, entry_line, color = color.new(color.red, 85))

    if trade.is_closed
        dep := (trade.profit / 100 * dep) + dep
        label.delete(entry_label)
        label.delete(sl_label)
        label.delete(tp1_label)
        label.delete(tp2_label)
        label.delete(tp3_label)
        label.delete(tp4_label)
        total_profit += trade.profit
        trade_count += 1
        if trade.profit >= 0
            profit_trades += 1
            wins_in_a_row += 1
            loss_in_a_row := 0
            win_streak := wins_in_a_row > win_streak ? wins_in_a_row : win_streak
        else
            loss_trades += 1
            loss_in_a_row += 1
            wins_in_a_row := 0
            loss_streak := loss_in_a_row > loss_streak ? loss_in_a_row : loss_streak
        trade := na

alertcondition(can_long and na(trade), "Long signal", "Long")
alertcondition(can_short and na(trade), "Short signal", "Short")
alertcondition(can_short or can_long and na(trade), "New signal", "Check chart to see signal direction")
if can_long or can_short and na(trade)
    first_trade_date := trade_count == 0 ? timestamp(year, month, dayofmonth, hour, minute) : first_trade_date
    trade := Trade.new()
    trade.side := can_long ? "LONG" : "SHORT"
    trade.entry_price := close
    trade.entry_hit := true
    trade.sl_price := math.round_to_mintick(can_long ? fixed_stop ? trade.entry_price * (1 - sl_percent) : fib_786 * (1 - sl_percent) : fixed_stop ? trade.entry_price * (1 + sl_percent) : fib_236 * (1 + sl_percent))
    trade.tp1_price := math.round_to_mintick(can_long ? trade.entry_price * (1 + tp1_percent) : trade.entry_price * (1 - tp1_percent))
    trade.tp1_percent_fix := tp1_percent_fix * 100
    trade.tp2_price := math.round_to_mintick(can_long ? trade.entry_price * (1 + tp2_percent) : trade.entry_price * (1 - tp2_percent))
    trade.tp2_percent_fix := tp2_percent_fix * 100
    trade.tp3_price := math.round_to_mintick(can_long ? trade.entry_price * (1 + tp3_percent) : trade.entry_price * (1 - tp3_percent))
    trade.tp3_percent_fix := tp3_percent_fix * 100
    trade.tp4_price := math.round_to_mintick(can_long ? trade.entry_price * (1 + tp4_percent) : trade.entry_price * (1 - tp4_percent))
    trade.tp4_percent_fix := tp4_percent_fix * 100
    trade.break_even_price := switch break_even_target
        "1" => trade.tp1_price
        "2" => trade.tp2_price
        "3" => trade.tp3_price
        "WITHOUT" => trade.tp4_price
    trade.risk_percent := risk_percent
    trade.risk_reward := calc_rr(trade.entry_price, trade.sl_price, trade.tp4_price)
    trade.start_bar_index := bar_index
    alert_message = "\n{\n" +  "    \"side\": \"" + str.tostring(trade.side) + "\",\n    \"entry\": \"" + str.tostring(trade.entry_price) + "\",\n    \"tp1\": \"" + str.tostring(trade.tp1_price) + "\",\n    \"tp2\": \"" + str.tostring(trade.tp2_price) + "\",\n    \"tp3\": \"" + str.tostring(trade.tp3_price) + "\",\n    \"tp4\": \"" + str.tostring(trade.tp4_price) + "\",\n    \"winrate\": \"" + str.tostring(RoundUp(profit_trades / trade_count * 100, 2)) + "%" + "\",\n    \"strategy\": \"" + strategy_input + "\",\n    \"beTargetTrigger\": \"" + break_even_target + "\",\n    \"stop\": \"" + str.tostring(trade.sl_price) + "\"\n}\n"
    alert(alert_message, alert.freq_once_per_bar_close)
    if show_tp_enty_sl
        entry_line  := line.new(x1=trade.start_bar_index, y1=trade.entry_price, x2=bar_index, y2=trade.entry_price, color=entry_color, style = line.style_solid, width = 2)
        entry_label := label.new(bar_index, trade.entry_price, str.tostring(trade.entry_price), style = label.style_label_left, color = color.rgb(255, 255, 255, 100), textcolor = color.gray)
        sl_line     := line.new(x1=trade.start_bar_index, y1=trade.sl_price, x2=bar_index, y2=trade.sl_price, color=sl_color, style = line_style, width = 2)
        sl_label := label.new(bar_index, trade.sl_price, str.tostring(trade.sl_price), style = label.style_label_left, color = color.rgb(255, 255, 255, 100), textcolor = color.red)
        tp1_line    := line.new(x1=trade.start_bar_index, y1=trade.tp1_price, x2=bar_index, y2=trade.tp1_price, color=tp_color, style = line_style, width = 2)
        tp1_label := label.new(bar_index, trade.tp1_price, str.tostring(trade.tp1_price), style = label.style_label_left, color = color.rgb(255, 255, 255, 100), textcolor = color.green)
        tp2_line    := line.new(x1=trade.start_bar_index, y1=trade.tp2_price, x2=bar_index, y2=trade.tp2_price, color=tp_color, style = line_style, width = 2)
        tp2_label := label.new(bar_index, trade.tp2_price, str.tostring(trade.tp2_price), style = label.style_label_left, color = color.rgb(255, 255, 255, 100), textcolor = color.green)
        tp3_line    := line.new(x1=trade.start_bar_index, y1=trade.tp3_price, x2=bar_index, y2=trade.tp3_price, color=tp_color, style = line_style, width = 2)
        tp3_label := label.new(bar_index, trade.tp3_price, str.tostring(trade.tp3_price), style = label.style_label_left, color = color.rgb(255, 255, 255, 100), textcolor = color.green)
        tp4_line    := line.new(x1=trade.start_bar_index, y1=trade.tp4_price, x2=bar_index, y2=trade.tp4_price, color=tp_color, style = line_style, width = 2)
        tp4_label := label.new(bar_index, trade.tp4_price, str.tostring(trade.tp4_price), style = label.style_label_left, color = color.rgb(255, 255, 255, 100), textcolor = color.green)
        lable_at_signal := label.new(bar_index, is_long_trend ? trade.tp4_price * 1.004 : trade.tp4_price * 0.996, "", style = label.style_label_center, textcolor = color.white)
    
//------------------------------------------------------RSI------------------------------------------------------------\\
rsi_value = ta.rsi(close, len)
is_overbought = rsi_value >= overbought
is_oversold = rsi_value <= oversold
plotshape(is_overbought and show_rsi ? high : na, color=color.red, style=shape.cross, size=size.tiny, location=location.abovebar)
plotshape(is_oversold and show_rsi ? low : na, color=color.green, style=shape.cross, size=size.tiny, location=location.belowbar)

//-----------------------------------------------------PANELS------------------------------------------------------------\\
lim = "-------------------------------------------------------"
high_idk = "╔════════════════════════════╗"
low_idk = "╚════════════════════════════╝"
panel_str1 = high_idk + "\n" + "[IMBA] ALGO" + "\n" + low_idk
panel_str13 = "First signal: " + str.format("{0,date,hh:mm} {0,date,long}", first_trade_date) + "\n" + lim
panel_str14 = "Signal closed: " + str.tostring(trade_count) + "                 " + "Winrate: " + str.tostring(RoundUp(profit_trades / trade_count * 100, 2)) + "%"
panel_str15 = "Profit signals: " + str.tostring(profit_trades) + "              " + "Loss signals: " + str.tostring(trade_count - profit_trades)
panel_str16 = "Win streak: " + str.tostring(win_streak) + "                  " + "Loss streak: " + str.tostring(loss_streak) + "\n" + lim
panel_str17 = "💰 Profit: " + str.tostring(total_profit, "#.##") + "% 💰"
panel_last = "╚════════════════════════════╝" 
panel_str_arr = array.from(panel_str1, panel_str13, panel_str14, panel_str15, panel_str16, panel_str17, panel_last)
if show_old_panel
    label l = label.new(bar_index + 20, close, text=array.join(panel_str_arr, "\n"), color=color.rgb(0, 0, 0, 87), style=label.style_label_left, textcolor=color.rgb(76, 187, 72),textalign=text.align_center)
    label.delete(l[1])

var table profit_table = na
if show_profit_panel
    profit_table := table.new(position.top_right, 3, 10, border_color = color.green, border_width = 0)
    table.cell(profit_table, 0, 0, "═════════════════════════════" + "\n" + "[IMBA] ALGO" + "\n" + "═════════════════════════════", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 6, height = 5, text_size = size.normal)
    table.cell(profit_table, 1, 0, "", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 6, height = 3, text_size = size.normal)
    table.merge_cells(profit_table, 0,0,1,0)
    table.cell(profit_table, 0, 1, "First trade:", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 8, height = 3, text_size = size.normal, text_halign = text.align_left)
    table.cell(profit_table, 1, 1, str.format("{0,date,long}", first_trade_date), bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 8, height = 3, text_size = size.normal)
    table.cell(profit_table, 0, 2, "Total trades:", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal, text_halign = text.align_left)
    table.cell(profit_table, 1, 2, str.tostring(trade_count), bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal)
    table.cell(profit_table, 0, 3, "Profit trades:", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal, text_halign = text.align_left)
    table.cell(profit_table, 1, 3, str.tostring(profit_trades), bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal)
    table.cell(profit_table, 0, 4, "Loss trades:", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal, text_halign = text.align_left)
    table.cell(profit_table, 1, 4, str.tostring(loss_trades), bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal)
    table.cell(profit_table, 0, 5, "Winrate:", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal, text_halign = text.align_left)
    table.cell(profit_table, 1, 5, str.tostring(RoundUp(profit_trades / trade_count * 100, 2)) + "%", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal)
    table.cell(profit_table, 0, 6, "Win streak:", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal, text_halign = text.align_left)
    table.cell(profit_table, 1, 6, str.tostring(win_streak), bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal)
    table.cell(profit_table, 0, 7, "Loss streak:", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal, text_halign = text.align_left)
    table.cell(profit_table, 1, 7, str.tostring(loss_streak), bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal)
    table.cell(profit_table, 0, 8, "Deposit: ", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal, text_halign = text.align_left)
    table.cell(profit_table, 1, 8, str.tostring(dep, "##.##"), bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal)
    table.cell(profit_table, 0, 9, "═════════════════════════════" + "\n" + "💰 Profit: " + str.tostring(total_profit, "#.##") + "% 💰" + "\n" + "═════════════════════════════", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 10, text_size = size.normal, text_halign = text.align_center, text_valign = text.align_top)
    table.cell(profit_table, 1, 9,"", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal)
    table.merge_cells(profit_table, 0, 9, 1, 9)

var table strategy_table = na
if show_strategy_panel
    strategy_table := table.new(position.bottom_right, 5, 6, border_color = color.green)
    table.cell(strategy_table, 1, 0, "══════════════════════════════════════════" + "\n" + syminfo.ticker + " " + timeframe.period + " | WR: " + str.tostring(profit_trades / (profit_trades + (trade_count - profit_trades)) * 100, "##,##") + "%" + " | TT: " + str.tostring(trade_count) + " | P: " +  str.tostring(total_profit, "#.##") + "%" + "\n" + "══════════════════════════════════════════", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 6, height = 7, text_size = size.normal, text_valign = text.align_bottom)
    table.cell(strategy_table, 2, 0, "", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 6, height = 3, text_size = size.normal)
    table.cell(strategy_table, 3, 0, "", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 6, height = 3, text_size = size.normal)
    table.cell(strategy_table, 4, 0, "", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 6, height = 3, text_size = size.normal)
    table.merge_cells(strategy_table, 1,0,4,0)
    table.cell(strategy_table, 1, 1, "Strategy:", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 6, height = 3, text_size = size.normal, text_halign = text.align_left)
    table.cell(strategy_table, 2, 1, strategy_input, bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 6, height = 3, text_size = size.normal)
    table.cell(strategy_table, 1, 2, "Sensitivity:", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal, text_halign = text.align_left)
    table.cell(strategy_table, 2, 2, str.tostring(sensitivity / 10), bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal)
    table.cell(strategy_table, 1, 3, "Risk:", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal, text_halign = text.align_left)
    table.cell(strategy_table, 2, 3, str.tostring(risk_percent) + "%", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal)
    table.cell(strategy_table, 1, 4, "BE target:", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal, text_halign = text.align_left)
    table.cell(strategy_table, 2, 4, str.tostring(break_even_target), bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal)
    table.cell(strategy_table, 1, 5, "Fixed stop:", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal, text_halign = text.align_left)
    table.cell(strategy_table, 2, 5, str.tostring(fixed_stop), bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal)

    table.cell(strategy_table, 3, 1, "TP1:", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 4, height = 3, text_size = size.normal)
    table.cell(strategy_table, 4, 1, str.tostring(tp1_percent * 100) + "%" + " (" + str.tostring(tp1_percent_fix * 100) + "%)", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal)
    table.cell(strategy_table, 3, 2, "TP2:", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 4, height = 3, text_size = size.normal)
    table.cell(strategy_table, 4, 2, str.tostring(tp2_percent * 100) + "%" + " (" + str.tostring(tp2_percent_fix * 100) + "%)", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal)
    table.cell(strategy_table, 3, 3, "TP3:", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 4, height = 3, text_size = size.normal)
    table.cell(strategy_table, 4, 3, str.tostring(tp3_percent * 100) + "%" + " (" + str.tostring(tp3_percent_fix * 100) + "%)", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal)
    table.cell(strategy_table, 3, 4, "TP4:", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 4, height = 3, text_size = size.normal)
    table.cell(strategy_table, 4, 4, str.tostring(tp4_percent * 100) + "%" + " (" + str.tostring(tp4_percent_fix * 100) + "%)", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 5, height = 3, text_size = size.normal)
    table.cell(strategy_table, 3, 5, "Stop:", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 4, height = 3, text_size = size.normal)
    table.cell(strategy_table, 4, 5, str.tostring(sl_percent * 100) + "%", bgcolor = color.rgb(0, 0, 0, 87), text_color = color.green, width = 8, height = 3, text_size = size.normal)