// This source code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/
// © LonesomeTheBlue

//@version=5
indicator('Support Resistance - Dynamic v2', 'SRv2', overlay=true)
prd = input.int(defval=10, title='Pivot Period', minval=4, maxval=30, group='Setup')
ppsrc = input.string(defval='High/Low', title='Source', options=['High/Low', 'Close/Open'], group='Setup')
maxnumpp = input.int(defval=20, title=' Maximum Number of Pivot', minval=5, maxval=100, group='Setup')
ChannelW = input.int(defval=10, title='Maximum Channel Width %', minval=1, group='Setup')
maxnumsr = input.int(defval=5, title=' Maximum Number of S/R', minval=1, maxval=10, group='Setup')
min_strength = input.int(defval=2, title=' Minimum Strength', minval=1, maxval=10, group='Setup')
labelloc = input.int(defval=20, title='Label Location', group='Colors', tooltip='Positive numbers reference future bars, negative numbers reference histical bars')
linestyle = input.string(defval='Dashed', title='Line Style', options=['Solid', 'Dotted', 'Dashed'], group='Colors')
linewidth = input.int(defval=2, title='Line Width', minval=1, maxval=4, group='Colors')
resistancecolor = input.color(defval=color.red, title='Resistance Color', group='Colors')
supportcolor = input.color(defval=color.lime, title='Support Color', group='Colors')
showpp = input(false, title='Show Point Points')

float src1 = ppsrc == 'High/Low' ? high : math.max(close, open)
float src2 = ppsrc == 'High/Low' ? low : math.min(close, open)
float ph = ta.pivothigh(src1, prd, prd)
float pl = ta.pivotlow(src2, prd, prd)

plotshape(ph and showpp, text='H', style=shape.labeldown, color=na, textcolor=color.new(color.red, 0), location=location.abovebar, offset=-prd)
plotshape(pl and showpp, text='L', style=shape.labelup, color=na, textcolor=color.new(color.lime, 0), location=location.belowbar, offset=-prd)

Lstyle = linestyle == 'Dashed' ? line.style_dashed : linestyle == 'Solid' ? line.style_solid : line.style_dotted

//calculate maximum S/R channel zone width
prdhighest = ta.highest(300)
prdlowest = ta.lowest(300)
cwidth = (prdhighest - prdlowest) * ChannelW / 100

var pivotvals = array.new_float(0)

if ph or pl
    array.unshift(pivotvals, ph ? ph : pl)
    if array.size(pivotvals) > maxnumpp  // limit the array size
        array.pop(pivotvals)

get_sr_vals(ind) =>
    float lo = array.get(pivotvals, ind)
    float hi = lo
    int numpp = 0
    for y = 0 to array.size(pivotvals) - 1 by 1
        float cpp = array.get(pivotvals, y)
        float wdth = cpp <= lo ? hi - cpp : cpp - lo
        if wdth <= cwidth  // fits the max channel width?
            if cpp <= hi
                lo := math.min(lo, cpp)
            else
                hi := math.max(hi, cpp)

            numpp += 1
            numpp
    [hi, lo, numpp]

var sr_up_level = array.new_float(0)
var sr_dn_level = array.new_float(0)
sr_strength = array.new_float(0)

find_loc(strength) =>
    ret = array.size(sr_strength)
    for i = ret > 0 ? array.size(sr_strength) - 1 : na to 0 by 1
        if strength <= array.get(sr_strength, i)
            break
        ret := i
        ret
    ret

check_sr(hi, lo, strength) =>
    ret = true
    for i = 0 to array.size(sr_up_level) > 0 ? array.size(sr_up_level) - 1 : na by 1
        //included?
        if array.get(sr_up_level, i) >= lo and array.get(sr_up_level, i) <= hi or array.get(sr_dn_level, i) >= lo and array.get(sr_dn_level, i) <= hi
            if strength >= array.get(sr_strength, i)
                array.remove(sr_strength, i)
                array.remove(sr_up_level, i)
                array.remove(sr_dn_level, i)
                ret
            else
                ret := false
                ret
            break
    ret

var sr_lines = array.new_line(11, na)
var sr_labels = array.new_label(11, na)

for x = 1 to 10 by 1
    rate = 100 * (label.get_y(array.get(sr_labels, x)) - close) / close
    label.set_text(array.get(sr_labels, x), text=str.tostring(label.get_y(array.get(sr_labels, x))) + '(' + str.tostring(rate, '#.##') + '%)')
    label.set_x(array.get(sr_labels, x), x=bar_index + labelloc)
    label.set_color(array.get(sr_labels, x), color=label.get_y(array.get(sr_labels, x)) >= close ? color.red : color.lime)
    label.set_textcolor(array.get(sr_labels, x), textcolor=label.get_y(array.get(sr_labels, x)) >= close ? color.white : color.black)
    label.set_style(array.get(sr_labels, x), style=label.get_y(array.get(sr_labels, x)) >= close ? label.style_label_down : label.style_label_up)
    line.set_color(array.get(sr_lines, x), color=line.get_y1(array.get(sr_lines, x)) >= close ? resistancecolor : supportcolor)

if ph or pl
    //because of new calculation, remove old S/R levels
    array.clear(sr_up_level)
    array.clear(sr_dn_level)
    array.clear(sr_strength)
    //find S/R zones
    for x = 0 to array.size(pivotvals) - 1 by 1
        [hi, lo, strength] = get_sr_vals(x)
        if check_sr(hi, lo, strength)
            loc = find_loc(strength)
            // if strength is in first maxnumsr sr then insert it to the arrays 
            if loc < maxnumsr and strength >= min_strength
                array.insert(sr_strength, loc, strength)
                array.insert(sr_up_level, loc, hi)
                array.insert(sr_dn_level, loc, lo)
                // keep size of the arrays = 5
                if array.size(sr_strength) > maxnumsr
                    array.pop(sr_strength)
                    array.pop(sr_up_level)
                    array.pop(sr_dn_level)

    for x = 1 to 10 by 1
        line.delete(array.get(sr_lines, x))
        label.delete(array.get(sr_labels, x))

    for x = 0 to array.size(sr_up_level) > 0 ? array.size(sr_up_level) - 1 : na by 1
        float mid = math.round_to_mintick((array.get(sr_up_level, x) + array.get(sr_dn_level, x)) / 2)
        rate = 100 * (mid - close) / close
        array.set(sr_labels, x + 1, label.new(x=bar_index + labelloc, y=mid, text=str.tostring(mid) + '(' + str.tostring(rate, '#.##') + '%)', color=mid >= close ? color.red : color.lime, textcolor=mid >= close ? color.white : color.black, style=mid >= close ? label.style_label_down : label.style_label_up))

        array.set(sr_lines, x + 1, line.new(x1=bar_index, y1=mid, x2=bar_index - 1, y2=mid, extend=extend.both, color=mid >= close ? resistancecolor : supportcolor, style=Lstyle, width=linewidth))

f_crossed_over() =>
    ret = false
    for x = 0 to array.size(sr_up_level) > 0 ? array.size(sr_up_level) - 1 : na by 1
        float mid = math.round_to_mintick((array.get(sr_up_level, x) + array.get(sr_dn_level, x)) / 2)
        if close[1] <= mid and close > mid
            ret := true
            ret
    ret

f_crossed_under() =>
    ret = false
    for x = 0 to array.size(sr_up_level) > 0 ? array.size(sr_up_level) - 1 : na by 1
        float mid = math.round_to_mintick((array.get(sr_up_level, x) + array.get(sr_dn_level, x)) / 2)
        if close[1] >= mid and close < mid
            ret := true
            ret
    ret
crossed_over = f_crossed_over()
crossed_under = f_crossed_under()
alertcondition(crossed_over, title='Resistance Broken', message='Resistance Broken')
alertcondition(crossed_under, title='Support Broken', message='Support Broken')
alertcondition(crossed_over or crossed_under, title='Support or Resistance Broken', message='Support or Resistance Broken')
