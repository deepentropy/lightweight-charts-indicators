//@version=5
indicator("Trend Channels With Liquidity Breaks [ChartPrime]", overlay=true, shorttitle="Trend Channels [ChartPrime]", max_lines_count = 50)

length = input.int(8, "Length")
show   = input.bool(true, "Show Last Channel")
wait   = input.bool(true, "Wait for Break")
extend = input.bool(false, "Extend Line")
enable_liquid = input.bool(false, "Volume BG")
top_color = input.color(color.rgb(51, 124, 79), "Colors", inline = "Colors")
center_color = input.color(color.gray, "", inline = "Colors")
bottom_color = input.color(color.rgb(165, 45, 45), "", inline = "Colors")

source_high = high
source_low  = low

// variables to store the latest and previous pivot values
var float prev_pivot_high = na
var int prev_pivot_high_index = na
var float last_pivot_high = na
var int last_pivot_high_index = na

var float prev_pivot_low = na
var int prev_pivot_low_index = na
var float last_pivot_low = na
var int last_pivot_low_index = na

atan2(y, x) =>
    var float angle = 0.0
    if x > 0
        angle := math.atan(y / x)
    else
        if x < 0 and y >= 0
            angle := math.atan(y / x) + math.pi
        else
            if x < 0 and y < 0
                angle := math.atan(y / x) - math.pi
            else
                if x == 0 and y > 0
                    angle := math.pi / 2
                else
                    if x == 0 and y < 0
                        angle := -math.pi / 2
    angle

min_max_volume(src) =>
    out = (src - ta.lowest(src, 100))/(ta.highest(src, 100) - ta.lowest(src, 100)) * 100
    math.max(math.min(100, out), 0)

volume_normalized()=>
    min_max_volume(ta.wma(volume, 21))

simple_moving_average(source)=>
    var float sum = na
    var int count = na
    count := nz(count[1]) + 1
    sum := nz(sum[1]) + source 
    sum/count

liquidity_break()=>
    vol = volume_normalized()
    avg = simple_moving_average(vol)
    rank = ta.percentile_nearest_rank(vol, 75, 100)
    avg_rank = simple_moving_average(rank)
    colour = vol < avg ? "LV" : (vol > avg and vol < avg_rank ? "MV" : "HV")


// Pivot high calculation
ph = ta.pivothigh(source_high, length, length)
if (not na(ph))
    // Update the previous pivot high to the last pivot high before we update the last pivot high
    prev_pivot_high := last_pivot_high
    prev_pivot_high_index := last_pivot_high_index
    // Update the last pivot high
    last_pivot_high := ph
    last_pivot_high_index := bar_index

// Pivot low calculation
pl = ta.pivotlow(source_low, length, length)
if (not na(pl))
    // Update the previous pivot low to the last pivot low before we update the last pivot low
    prev_pivot_low := last_pivot_low
    prev_pivot_low_index := last_pivot_low_index
    // Update the last pivot low
    last_pivot_low := pl
    last_pivot_low_index := bar_index

volume_score = volume_normalized()

var down_trend_top = line.new(na, na, na, na, color = na, width = 2)
var down_trend_bottom = line.new(na, na, na, na, color = na, width = 2)
var down_trend_top_zone = line.new(na, na, na, na, color = color.new(color.black, 100), width = 2)
var down_trend_bottom_zone = line.new(na, na, na, na, color = color.new(color.black, 100), width = 2)
var down_trend_top_zone_mid = line.new(na, na, na, na, color = color.new(color.black, 100), width = 2)
var down_trend_bottom_zone_mid = line.new(na, na, na, na, color = color.new(color.black, 100), width = 2)
var down_trend_center = line.new(na, na, na, na, color = na, width = 2, style = line.style_dashed)
var down_break_label = label.new(na, na, na, textcolor = color.new(color.silver, 0))
linefill.new(down_trend_top, down_trend_top_zone_mid, color.new(top_color, 20))
linefill.new(down_trend_bottom, down_trend_bottom_zone_mid, color.new(bottom_color, 20))
down_trend_top_zone_mid_fill = linefill.new(down_trend_top_zone_mid, down_trend_top_zone, color.new(top_color, 80))
down_trend_bottom_zone_mid_fill = linefill.new(down_trend_bottom_zone_mid, down_trend_bottom_zone, color.new(bottom_color, 80))
var up_trend_top = line.new(na, na, na, na, color = na, width = 2)
var up_trend_bottom = line.new(na, na, na, na, color = na, width = 2)
var up_trend_top_zone = line.new(na, na, na, na, color = color.new(color.black, 100), width = 2)
var up_trend_bottom_zone = line.new(na, na, na, na, color = color.new(color.black, 100), width = 2)
var up_trend_top_zone_mid = line.new(na, na, na, na, color = color.new(color.black, 100), width = 2)
var up_trend_bottom_zone_mid = line.new(na, na, na, na, color = color.new(color.black, 100), width = 2)
var up_trend_center = line.new(na, na, na, na, color = na, width = 2, style = line.style_dashed)
linefill.new(up_trend_top, up_trend_top_zone_mid, color.new(top_color, 20))
linefill.new(up_trend_bottom, up_trend_bottom_zone_mid, color.new(bottom_color, 20))
top_trend_top_zone_mid_fill = linefill.new(up_trend_top_zone_mid, up_trend_top_zone, color.new(top_color, 80))
top_trend_bottom_zone_mid_fill = linefill.new(up_trend_bottom_zone_mid, up_trend_bottom_zone, color.new(bottom_color, 80))
var up_break_label = label.new(na, na, na, textcolor = color.new(color.silver, 0), style = label.style_label_up)

if extend
    line.set_extend(down_trend_top, extend.right)
    line.set_extend(down_trend_bottom, extend.right)
    line.set_extend(down_trend_top_zone, extend.right)
    line.set_extend(down_trend_bottom_zone, extend.right)
    line.set_extend(down_trend_center, extend.right)
    line.set_extend(up_trend_top, extend.right)
    line.set_extend(up_trend_bottom, extend.right)
    line.set_extend(up_trend_top_zone, extend.right)
    line.set_extend(up_trend_bottom_zone, extend.right)
    line.set_extend(up_trend_center, extend.right)
    line.set_extend(down_trend_top_zone_mid, extend.right)
    line.set_extend(down_trend_bottom_zone_mid, extend.right)
    line.set_extend(up_trend_top_zone_mid, extend.right)
    line.set_extend(up_trend_bottom_zone_mid, extend.right)
else
    line.set_extend(down_trend_top, extend.none)
    line.set_extend(down_trend_bottom, extend.none)
    line.set_extend(down_trend_top_zone, extend.none)
    line.set_extend(down_trend_bottom_zone, extend.none)
    line.set_extend(down_trend_center, extend.none)
    line.set_extend(up_trend_top, extend.none)
    line.set_extend(up_trend_bottom, extend.none)
    line.set_extend(up_trend_top_zone, extend.none)
    line.set_extend(up_trend_bottom_zone, extend.none)
    line.set_extend(up_trend_center, extend.none)
    line.set_extend(down_trend_top_zone_mid, extend.none)
    line.set_extend(down_trend_bottom_zone_mid, extend.none)
    line.set_extend(up_trend_top_zone_mid, extend.none)
    line.set_extend(up_trend_bottom_zone_mid, extend.none)

var down_dydx = 0.
var up_dydx = 0.

atr_10 = ta.atr(10) * 6
var down_count = 0
var up_count = 0

// Plot the trendlines if we have enough pivots
if (not na(prev_pivot_high)
 and not na(last_pivot_high)) 
 and prev_pivot_high != prev_pivot_high[1] 
 and atan2(last_pivot_high - prev_pivot_high, last_pivot_high_index - prev_pivot_high_index) <= 0 
 and down_count == 0 
 and (wait ? up_count != 1 : true)
 and barstate.isconfirmed
    down_count := 1
    offset = atr_10
    line.set_xy1(down_trend_top, prev_pivot_high_index - length, math.round_to_mintick(prev_pivot_high + offset/7))
    line.set_xy2(down_trend_top, last_pivot_high_index - length, math.round_to_mintick(last_pivot_high + offset/7))
    line.set_color(down_trend_top, top_color)
    line.set_xy1(down_trend_top_zone, prev_pivot_high_index - length, math.round_to_mintick(prev_pivot_high - offset/7))
    line.set_xy2(down_trend_top_zone, last_pivot_high_index - length, math.round_to_mintick(last_pivot_high - offset/7))
    line.set_xy1(down_trend_top_zone_mid, prev_pivot_high_index - length, prev_pivot_high)
    line.set_xy2(down_trend_top_zone_mid, last_pivot_high_index - length, last_pivot_high)
    down_dydx := (last_pivot_high - prev_pivot_high) / (last_pivot_high_index - prev_pivot_high_index)
    line.set_xy1(down_trend_bottom, prev_pivot_high_index - length, math.round_to_mintick(prev_pivot_high - offset - offset/7))
    line.set_xy2(down_trend_bottom, last_pivot_high_index - length, math.round_to_mintick(last_pivot_high - offset - offset/7))
    line.set_color(down_trend_bottom, bottom_color)
    line.set_xy1(down_trend_bottom_zone, prev_pivot_high_index - length, math.round_to_mintick(prev_pivot_high - offset + offset/7))
    line.set_xy2(down_trend_bottom_zone, last_pivot_high_index - length, math.round_to_mintick(last_pivot_high - offset + offset/7))
    line.set_xy1(down_trend_bottom_zone_mid, prev_pivot_high_index - length, math.round_to_mintick(prev_pivot_high - offset))
    line.set_xy2(down_trend_bottom_zone_mid, last_pivot_high_index - length, math.round_to_mintick(last_pivot_high - offset))

    // Set center line for down trend
    line.set_xy1(down_trend_center, prev_pivot_high_index - length, math.round_to_mintick((prev_pivot_high + prev_pivot_high - offset) / 2))
    line.set_xy2(down_trend_center, last_pivot_high_index - length, math.round_to_mintick((last_pivot_high + last_pivot_high - offset) / 2))
    line.set_color(down_trend_center, center_color)
    label.set_text(down_break_label, "")
    label.set_color(down_break_label, color.new(color.black, 100))
    // Blank previous channel
    if not show
        line.set_xy1(up_trend_bottom, na, na)
        line.set_xy2(up_trend_bottom, na, na)
        line.set_xy1(up_trend_top, na, na)
        line.set_xy2(up_trend_top, na, na)
        line.set_xy1(up_trend_center, na, na)
        line.set_xy2(up_trend_center, na, na)
        line.set_xy1(up_trend_bottom_zone, na, na)
        line.set_xy2(up_trend_bottom_zone, na, na)
        line.set_xy1(up_trend_bottom_zone_mid, na, na)
        line.set_xy2(up_trend_bottom_zone_mid, na, na)
        line.set_xy1(up_trend_top_zone, na, na)
        line.set_xy2(up_trend_top_zone, na, na)
        line.set_xy1(up_trend_top_zone_mid, na, na)
        line.set_xy2(up_trend_top_zone_mid, na, na)
        label.set_text(up_break_label, "")
        label.set_color(up_break_label, color.new(color.black, 100))

if (not na(prev_pivot_low)
 and not na(last_pivot_low)) 
 and prev_pivot_low != prev_pivot_low[1] 
 and atan2(last_pivot_low - prev_pivot_low, last_pivot_low_index - prev_pivot_low_index) >= 0 
 and up_count == 0 
 and (wait ? down_count != 1 : true)
 and barstate.isconfirmed
    up_count := 1
    offset = atr_10
    line.set_xy1(up_trend_top, prev_pivot_low_index - length, math.round_to_mintick(prev_pivot_low + offset + offset/7))
    line.set_xy2(up_trend_top, last_pivot_low_index - length, math.round_to_mintick(last_pivot_low + offset + offset/7))
    line.set_color(up_trend_top, top_color)
    line.set_xy1(up_trend_top_zone, prev_pivot_low_index - length, math.round_to_mintick(prev_pivot_low + offset - offset/7))
    line.set_xy2(up_trend_top_zone, last_pivot_low_index - length, math.round_to_mintick(last_pivot_low + offset - offset/7))
    line.set_xy1(up_trend_top_zone_mid, prev_pivot_low_index - length, math.round_to_mintick(prev_pivot_low + offset))
    line.set_xy2(up_trend_top_zone_mid, last_pivot_low_index - length, math.round_to_mintick(last_pivot_low + offset))
    line.set_xy1(up_trend_bottom, prev_pivot_low_index - length, math.round_to_mintick(prev_pivot_low - offset/7))
    line.set_xy2(up_trend_bottom, last_pivot_low_index - length, math.round_to_mintick(last_pivot_low - offset/7))
    line.set_color(up_trend_bottom, bottom_color)
    line.set_xy1(up_trend_bottom_zone, prev_pivot_low_index - length, math.round_to_mintick(prev_pivot_low + offset/7))
    line.set_xy2(up_trend_bottom_zone, last_pivot_low_index - length, math.round_to_mintick(last_pivot_low + offset/7))
    line.set_xy1(up_trend_bottom_zone_mid, prev_pivot_low_index - length, math.round_to_mintick(prev_pivot_low))
    line.set_xy2(up_trend_bottom_zone_mid, last_pivot_low_index - length, math.round_to_mintick(last_pivot_low))
    up_dydx := (last_pivot_low - prev_pivot_low) / (last_pivot_low_index - prev_pivot_low_index)
    // Set center line for up trend
    line.set_xy1(up_trend_center, prev_pivot_low_index - length, math.round_to_mintick((prev_pivot_low + prev_pivot_low + offset) / 2))
    line.set_xy2(up_trend_center, last_pivot_low_index - length, math.round_to_mintick((last_pivot_low + last_pivot_low + offset) / 2))
    line.set_color(up_trend_center, center_color)
    label.set_text(up_break_label, "")
    label.set_color(up_break_label, color.new(color.black, 100))
    // Blank previous channel
    if not show
        line.set_xy1(down_trend_bottom, na, na)
        line.set_xy2(down_trend_bottom, na, na)
        line.set_xy1(down_trend_top, na, na)
        line.set_xy2(down_trend_top, na, na)
        line.set_xy1(down_trend_center, na, na)
        line.set_xy2(down_trend_center, na, na)
        line.set_xy1(down_trend_bottom_zone, na, na)
        line.set_xy2(down_trend_bottom_zone, na, na)
        line.set_xy1(down_trend_bottom_zone_mid, na, na)
        line.set_xy2(down_trend_bottom_zone_mid, na, na)
        line.set_xy1(down_trend_top_zone, na, na)
        line.set_xy2(down_trend_top_zone, na, na)
        line.set_xy1(down_trend_top_zone_mid, na, na)
        line.set_xy2(down_trend_top_zone_mid, na, na)
        label.set_text(down_break_label, "")
        label.set_color(down_break_label, color.new(color.black, 100))

liquidity_score = liquidity_break()
volume_color_high = color.new(top_color, 60 + (100 - volume_score)/5)
volume_color_low = color.new(bottom_color, 60 + (100 - volume_score)/5)

atr_20 = ta.atr(20)/1.5
if down_count == 1
    if enable_liquid    
        linefill.set_color(down_trend_top_zone_mid_fill, volume_color_high)
        linefill.set_color(down_trend_bottom_zone_mid_fill, volume_color_low)
    if not extend
        line.set_y2(down_trend_top, line.get_y2(down_trend_top) + down_dydx)
        line.set_y2(down_trend_bottom, line.get_y2(down_trend_bottom) + down_dydx)
        line.set_y2(down_trend_top_zone, line.get_y2(down_trend_top_zone) + down_dydx)
        line.set_y2(down_trend_bottom_zone, line.get_y2(down_trend_bottom_zone) + down_dydx)
        line.set_y2(down_trend_top_zone_mid, line.get_y2(down_trend_top_zone_mid) + down_dydx)
        line.set_y2(down_trend_bottom_zone_mid, line.get_y2(down_trend_bottom_zone_mid) + down_dydx)
        line.set_y2(down_trend_center, line.get_y2(down_trend_center) + down_dydx)
        line.set_x2(down_trend_top, bar_index)
        line.set_x2(down_trend_bottom, bar_index)
        line.set_x2(down_trend_top_zone, bar_index)
        line.set_x2(down_trend_bottom_zone, bar_index)
        line.set_x2(down_trend_top_zone_mid, bar_index)
        line.set_x2(down_trend_bottom_zone_mid, bar_index)
        line.set_x2(down_trend_center, bar_index)

    if low > line.get_price(down_trend_top, bar_index)
        down_count := 0
        label.set_text(down_break_label, liquidity_score)
        label.set_color(down_break_label, top_color)
        label.set_style(down_break_label, label.style_label_up)
        label.set_xy(down_break_label, bar_index, line.get_y2(down_trend_top) - atr_20)
    if high < line.get_price(down_trend_bottom, bar_index)
        down_count := 0
        label.set_text(down_break_label, liquidity_score)
        label.set_color(down_break_label, bottom_color)
        label.set_style(down_break_label, label.style_label_down)
        label.set_xy(down_break_label, bar_index, line.get_y2(down_trend_bottom) + atr_20)

if up_count == 1
    if enable_liquid
        linefill.set_color(top_trend_top_zone_mid_fill, volume_color_high)
        linefill.set_color(top_trend_bottom_zone_mid_fill, volume_color_low)
    if not extend
        line.set_y2(up_trend_top, line.get_y2(up_trend_top) + up_dydx)
        line.set_y2(up_trend_bottom, line.get_y2(up_trend_bottom) + up_dydx)
        line.set_y2(up_trend_top_zone, line.get_y2(up_trend_top_zone) + up_dydx)
        line.set_y2(up_trend_bottom_zone, line.get_y2(up_trend_bottom_zone) + up_dydx)
        line.set_y2(up_trend_top_zone_mid, line.get_y2(up_trend_top_zone_mid) + up_dydx)
        line.set_y2(up_trend_bottom_zone_mid, line.get_y2(up_trend_bottom_zone_mid) + up_dydx)
        line.set_y2(up_trend_center, line.get_y2(up_trend_center) + up_dydx)
        line.set_x2(up_trend_top, bar_index)
        line.set_x2(up_trend_bottom, bar_index)
        line.set_x2(up_trend_top_zone, bar_index)
        line.set_x2(up_trend_bottom_zone, bar_index)
        line.set_x2(up_trend_top_zone_mid, bar_index)
        line.set_x2(up_trend_bottom_zone_mid, bar_index)
        line.set_x2(up_trend_center, bar_index)

    if low > line.get_price(up_trend_top, bar_index) and barstate.isconfirmed
        up_count := 0
        label.set_text(up_break_label, liquidity_score)
        label.set_color(up_break_label, top_color)
        label.set_style(up_break_label, label.style_label_up)
        label.set_xy(up_break_label, bar_index, line.get_y2(up_trend_top) - atr_20)
    if high < line.get_price(up_trend_bottom, bar_index) and barstate.isconfirmed
        up_count := 0
        label.set_text(up_break_label, liquidity_score)
        label.set_color(up_break_label, bottom_color)
        label.set_style(up_break_label, label.style_label_down)
        label.set_xy(up_break_label, bar_index, line.get_y2(up_trend_bottom) + atr_20)