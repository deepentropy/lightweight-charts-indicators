// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator('ICT Macros [LuxAlgo]', overlay = true, max_lines_count = 500, max_labels_count = 100)
//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
group_ln     = 'London Time Settings'
lnSummerTime = input.bool(true , 'London Daylight Saving Time (DST)', group = group_ln, tooltip = 'London : Daylight Saving Time (DST)\n - DST Start : Last Sunday in March at 1:00 UTC\n - DST End   : Last Sunday in October at 1:00 UTC')

group_m02 = 'London 02:33 AM 03:00 Macro'
m02330300 = input.bool(false, '02:33 AM 03:00', group = group_m02)
m02_top   = input.bool(true, 'Top Line', inline = 'mc02', group = group_m02)
m02_mid   = input.bool(true, 'Mid Line', inline = 'mc02', group = group_m02)
m02_bot   = input.bool(true, 'Bottom Line', inline = 'mc02', group = group_m02)
m02_ext   = input.bool(true, 'Extending Lines', inline = 'mc02', group = group_m02)

group_m04 = 'London 04:03 AM 04:30 Macro'
m04030430 = input.bool(false, '04:03 AM 04:30', group = group_m04)
m04_top   = input.bool(true, 'Top Line', inline = 'mc04', group = group_m04)
m04_mid   = input.bool(true, 'Mid Line', inline = 'mc04', group = group_m04)
m04_bot   = input.bool(true, 'Bottom Line', inline = 'mc04', group = group_m04)
m04_ext   = input.bool(true, 'Extending Lines', inline = 'mc04', group = group_m04)

group_ny     = 'New York Time Settings'
nySummerTime = input.bool(true , 'New York Daylight Saving Time (DST)', group = group_ny, tooltip = 'New York : Daylight Saving Time (DST)\n - DST Start : Second Sunday in March at 2:00\n - DST End   : First Sunday in November at 2:00')

group_m08 = 'New York 08:50 AM 09:10 Macro'
m08500910 = input.bool(false, '08:50 AM 09:10', group = group_m08)
m08_top   = input.bool(true, 'Top Line', inline = 'mc08', group = group_m08)
m08_mid   = input.bool(true, 'Mid Line', inline = 'mc08', group = group_m08)
m08_bot   = input.bool(true, 'Bottom Line', inline = 'mc08', group = group_m08)
m08_ext   = input.bool(true, 'Extending Lines', inline = 'mc08', group = group_m08)

group_m09 = 'New York 09:50 AM 10:10 Macro'
m09501010 = input.bool(true , '09:50 AM 10:10', group = group_m09)
m09_top   = input.bool(true, 'Top Line', inline = 'mc09', group = group_m09)
m09_mid   = input.bool(true, 'Mid Line', inline = 'mc09', group = group_m09)
m09_bot   = input.bool(true, 'Bottom Line', inline = 'mc09', group = group_m09)
m09_ext   = input.bool(true, 'Extending Lines', inline = 'mc09', group = group_m09)

group_m10 = 'New York 10:50 AM 11:10 Macro'
m10501110 = input.bool(true , '10:50 AM 11:10', group = group_m10)
m10_top   = input.bool(true, 'Top Line', inline = 'mc10', group = group_m10)
m10_mid   = input.bool(true, 'Mid Line', inline = 'mc10', group = group_m10)
m10_bot   = input.bool(true, 'Bottom Line', inline = 'mc10', group = group_m10)
m10_ext   = input.bool(true, 'Extending Lines', inline = 'mc10', group = group_m10)

group_m11 = 'New York 11:50 AM 12:10 Launch Macro'
m11501210 = input.bool(false, '11:50 AM 12:10', group = group_m11)
m11_top   = input.bool(true, 'Top Line', inline = 'mc11', group = group_m11)
m11_mid   = input.bool(true, 'Mid Line', inline = 'mc11', group = group_m11)
m11_bot   = input.bool(true, 'Bottom Line', inline = 'mc11', group = group_m11)
m11_ext   = input.bool(true, 'Extending Lines', inline = 'mc11', group = group_m11)

group_m13 = 'New York 13:10 PM 13:40 Macro'
m13101340 = input.bool(true , '13:10 PM 13:40', group = group_m13)
m13_top   = input.bool(true, 'Top Line', inline = 'mc13', group = group_m13)
m13_mid   = input.bool(true, 'Mid Line', inline = 'mc13', group = group_m13)
m13_bot   = input.bool(true, 'Bottom Line', inline = 'mc13', group = group_m13)
m13_ext   = input.bool(true, 'Extending Lines', inline = 'mc13', group = group_m13)

group_m15 = 'New York 15:15 PM 15:45 Macro'
m15151545 = input.bool(true , '15:15 PM 15:45', group = group_m15)
m15_top   = input.bool(true, 'Top Line', inline = 'mc15', group = group_m15)
m15_mid   = input.bool(true, 'Mid Line', inline = 'mc15', group = group_m15)
m15_bot   = input.bool(true, 'Bottom Line', inline = 'mc15', group = group_m15)
m15_ext   = input.bool(true, 'Extending Lines', inline = 'mc15', group = group_m15)

group_c   = 'Macro Classification'
pLen      = input.int(13, 'Length', minval = 5, maxval = 20, group = group_c)
pLoc      = input.string('Body', 'Swing Area', options = ['Wick', 'Body'], group = group_c)

aColor    = input.color(color.gray, 'Accumulation', group = group_c)
mColor    = input.color(color.red , 'Manipulation', group = group_c)
eColor    = input.color(color.blue, 'Expansion'   , group = group_c)

mcText    = input.string('Small', "Macro Texts", options=['Tiny', 'Small', 'Normal', 'None'])

mcSize = switch mcText
    'Tiny'   => size.tiny
    'Small'  => size.small
    'Normal' => size.normal
    => size.tiny

mcAlert    = input.bool(true, 'Alert Macro Times in Advance (Minutes)', inline = 'alert', tooltip = 'Enabling the option will plot a vertical line for the next macro time prior to the specified minutes\n\nNote: for alert configuration if not on 1 min chart please use round numbers')
mcAlertM   = input.int(30, '', minval = 5, maxval = 60, step = 5, inline = 'alert')

//-----------------------------------------------------------------------------}
//UDT's
//-----------------------------------------------------------------------------{
type bar
    float o = open
    float h = high
    float l = low
    float c = close
    int   t = time

type macro
    int   t         // unix time 
    int   x2        // end bar_index
    int   len       // macro length
    float o         // macro open price value
    float top       // macro top price value
    float bottom    // macro bottom price value
    float mid       // macro mid price value
    float co        // macro close open price value
    float ch        // macro close high price value
    float cl        // macro close low price value
    float cc        // macro close close price value
    line  lnh       // macro top line
    line  lnhe      // macro top line - extended
    line  lnl       // macro bottom line
    line  lnle      // macro bottom line - extended
    line  lnm       // macro mid line
    line  lnme      // macro mid line - extended
    line  lnf       // next macro start
    linefill lf     // macro box (linefill)
    label  lb       // macro label
    string xloc    = xloc.bar_index
    color  color   = chart.fg_color
    color  nocolor = chart.bg_color

type pivotPoint
    int   ht  // pivot high unix time
    int   lt  // pivot low unix time
    float h   // last pivot high price value
    float h1  // previous pivot high price value
    float l   // last pivot low price value
    float l1  // previous pivot low price value

//-----------------------------------------------------------------------------}
//Methods / Functions
//-----------------------------------------------------------------------------{
// @function         updates horizontal line's y1 and y2 value
// @param _ln        (line) line to be updated
// @param _y         (float) The new value
// @returns          none

method set_y(line _ln, float _y) => _ln.set_y1(_y), _ln.set_y2(_y)

// @function              get the current bar's unix time, hour and minute
// @param _utc            (string) utc and major city in the form of '(UTC-05:00) NEW YORK'
// @param _dst            (bool) daylight saving time 
// @param _utcTimeOffset  (array) array storing the utc info 
// @param _utcCity        (array) array storing the major city info 
// @param _inAd           (int) ofsset value in minutes 
// @param _tf_m           (int) timeframe multiplier 
// @returns               A tuple containing (int) index, (int) hour and (int) minute

method f_getBarTime(string _utc, _dst, _utcTimeOffset, _utcCity, _inAd, _tf_m) =>
    utcTime = (array.get(_utcTimeOffset, array.indexof(_utcCity, _utc)) + (_dst ? 1 : 0)) * 3600000 + _inAd * 60000 + time

    h = math.floor(utcTime / 3600000) % 24
    m = math.floor(utcTime / 60000) % 60
    int idx = 0

    if _tf_m == 3
        if m == 48
            m := m + 2
            idx := 2
        else if m == 9
            m := m + 1
            idx := 1
        //else if m == 12 or m == 42
        //    idx := 0
    else if _tf_m == 5
        if (m == 0 and h == 9) or (m == 30 and h == 7)
            m := m + 3
            idx := 3

    [idx, h, m]

// @function         calculate and get customized pivot points high low and time values
// @param _len       (int) length for the pivot points high low calculation
// @param _loc       (string) if set to 'wick' highest/lowest values of the detected pivot points high low will be calculated
//                            if set to 'Body' the highest/lowest values of the candel bodies will be returend as pivot points high low
// @returns          A tuple containing (float) ph - pivot high, (float) pl - pivot low, (int) pht - pivot high unix time (int) plt - pivot low unix time

method f_getPivotPoint(int _len, _loc) =>
    ph  = ta.pivothigh(_len, _len)
    if ph and _loc == 'Body'
        ph  := math.max(open[_len], close[_len])

    pl  = ta.pivotlow (_len, _len)
    if pl and _loc == 'Body'
        pl  := math.min(open[_len], close[_len])

    pht = ph ? time[_len] : na
    plt = pl ? time[_len] : na

    [ph, pl, pht, plt]

//-----------------------------------------------------------------------------}
//Main variables
//-----------------------------------------------------------------------------{
tf_m = timeframe.multiplier
bi   = bar_index

var a_majorCity = array.new_string(), var a_utcTimeOffset = array.new_float(), var a_utcCity = array.new_string()

if barstate.isfirst 
    array.push(a_majorCity, 'NEW YORK'), array.push(a_utcTimeOffset, -5), array.push(a_utcCity, '(UTC-05:00) NEW YORK')
    array.push(a_majorCity, 'LONDON'  ), array.push(a_utcTimeOffset, 0 ), array.push(a_utcCity, '(UTC+00:00) LONDON'  )

// Lower TF bar UDT array 
ltfB = request.security_lower_tf(syminfo.tickerid, '1', bar.new())

// Lower TF pivotPoint UDT arrays
var pivotPoint p = pivotPoint.new()

[a_pH, a_pL, a_pHt, a_pLt] = request.security_lower_tf(syminfo.tickerid, '1', f_getPivotPoint(pLen, pLoc))

if not na(array.min(a_pL))
    p.l  := array.min(a_pL)
    p.lt := array.min(a_pLt) 

if not na(array.max(a_pH))
    p.h  := array.max(a_pH)
    p.ht := array.max(a_pHt)

//-----------------------------------------------------------------------------}
//Detect ICT macros
//-----------------------------------------------------------------------------{
var macro mc = macro.new()

// @function        main function : detects macros, draws nad controls macro components and classifies macros
// @param _m        (bool) enable/disable specific macro 
// @param _msh      (int) macro start hour
// @param _msm      (int) macro start minute
// @param _mh       (bool) macro top line control option
// @param _ml       (bool) macro bottom line control option
// @param _mm       (bool) macro middle line control option
// @param _me       (bool) macro extended lines control option
// @param _mt       (bool) macro label text value
//
// @param _utc      (string) utc and major city in the form of '(UTC-05:00) NEW YORK'
// @param _dst      (bool) daylight saving time 
// @param _tf_m     (int) timeframe multiplier 
// @param _alert    (bool) next macro time start location, displays in _alertM minutes 
// @param _alertM   (int) alert in _alertM minutes 
// @returns         macro UDT components created 

processMacro(_m, _msh, _msm, _mh, _ml, _mm, _me, _mt, _utc, _dst, _tf_m, _alert, _alertM) =>
    if _m

        [_, ha, ma] = f_getBarTime(_utc, _dst, a_utcTimeOffset, a_utcCity, _alertM, _tf_m)

        if ha == _msh and ma == _msm
            alert(_mt + ' macro will be in play in ' + str.tostring(_alertM) + ' minutes for instrument ' + syminfo.ticker)
            
            if _alert
                mc.lnf  := line.new(time + _alertM * 60000 , high, time + _alertM * 60000, low, xloc.bar_time, extend.both, mc.color, line.style_solid , 1)

        [idx, h, m] = f_getBarTime(_utc, _dst, a_utcTimeOffset, a_utcCity, 0, _tf_m)

        if h == 8 or h == 9 or h == 10 or h == 11
            if m == 3
                mc.len := 27
            else
                mc.len := 20
        else if h == 7
            mc.len := 27
        else 
            mc.len := 30

        if h == _msh and  m == _msm
            mc.lnf.delete()
            
            if ltfB.size() > idx
                if not na(ltfB.get(idx).h)
                    mc.t      := ltfB.get(idx).t
                    mc.o      := ltfB.get(idx).o
                    mc.top    := ltfB.get(idx).h
                    mc.bottom := ltfB.get(idx).l

            if idx == 0
                mc.x2 := bi + math.round(mc.len / _tf_m)
            else
                mc.x2 := bi + math.round(mc.len / _tf_m) + 1
            
            mc.lnh  := line.new(bi, mc.top, int(mc.x2), mc.top, color = _mh ? mc.color : mc.nocolor, style = line.style_solid , width = 2)
            mc.lnhe := line.new(int(mc.x2), mc.top, int(mc.x2), mc.top, color = _me ? _mh ? mc.color : mc.nocolor : mc.nocolor, style = line.style_dotted, width = 2)
            
            mc.lnl  := line.new(bi, mc.bottom, int(mc.x2), mc.bottom, color =_ml ? mc.color : mc.nocolor, style = line.style_solid , width = 2)
            mc.lnle := line.new(int(mc.x2), mc.bottom, int(mc.x2), mc.bottom, color = _me ? _ml ? mc.color : mc.nocolor : mc.nocolor, style = line.style_dotted, width = 2)
            
            mc.lnm  := line.new(bi, math.avg(mc.top, mc.bottom), int(mc.x2), math.avg(mc.top, mc.bottom), color = _mm ? mc.color : mc.nocolor, style = line.style_dotted, width = 1)
            mc.lnme := line.new(bi, math.avg(mc.top, mc.bottom), int(mc.x2), math.avg(mc.top, mc.bottom), color = _me ? _mm ? mc.color : mc.nocolor : mc.nocolor, style = line.style_dotted, width = 1)
            
            mc.lf   := linefill.new(mc.lnh, mc.lnl, color.new(color.gray, 100))
            mc.lb   := label.new(bi + int(mc.len / _tf_m / 2), mc.top, mcText != 'None' ? 'MACRO\n' + _mt : '', xloc.bar_index, yloc.price, #00000000, label.style_label_down, chart.fg_color, mcSize, text.align_left, '')
            
            p.l1 := p.l
            p.h1 := p.h

        else if bi < int(mc.x2) and time >= mc.t

            mc.top := math.max(high, mc.lnh.get_y1())
            mc.lnh.set_y(mc.top), mc.lnhe.set_y(mc.top)

            mc.bottom := math.min(low , mc.lnl.get_y1())
            mc.lnl.set_y(mc.bottom), mc.lnle.set_y(mc.bottom)

            mc.mid := math.avg(math.max(high, mc.lnh.get_y1()), math.min(low , mc.lnl.get_y1()))
            mc.lnm.set_y(mc.mid), mc.lnme.set_y(mc.mid)

            mc.lb.set_y(math.max(high, mc.lb.get_y()))

            if not na(array.min(a_pL)) and p.lt < mc.t
                p.l1  := array.min(a_pL)

            if not na(array.max(a_pH)) and p.ht < mc.t
                p.h1  := array.max(a_pH)

        else if bi == int(mc.x2)

            if ltfB.size() > idx
                if not na(ltfB.get(idx).c)
                    mc.co := ltfB.get(idx).o
                    mc.ch := ltfB.get(idx).h
                    mc.cl := ltfB.get(idx).l
                    mc.cc := ltfB.get(idx).c

            mc.top := math.max(mc.ch, mc.lnh.get_y1())
            mc.lnh.set_y(mc.top), mc.lnhe.set_y(mc.top)

            mc.bottom := math.min(mc.cl , mc.lnl.get_y1())
            mc.lnl.set_y(mc.bottom), mc.lnle.set_y(mc.bottom)

            mc.mid := math.avg(math.max(mc.top, mc.lnh.get_y1()), math.min(mc.bottom , mc.lnl.get_y1()))
            mc.lnm.set_y(mc.mid), mc.lnme.set_y(mc.mid)

            mc.lb.set_y(math.max(mc.top, mc.lb.get_y()))

            if not na(array.min(a_pL)) and p.lt < mc.t
                p.l1  := array.min(a_pL)

            if not na(array.max(a_pH)) and p.ht < mc.t
                p.h1  := array.max(a_pH)

        else if mc.t == mc.t[1]

            mc.lnhe.set_x2(bi), mc.lnle.set_x2(bi), mc.lnme.set_x2(bi)


        if bi == int(mc.x2) + 1 and not str.contains(mc.lb.get_text(), 'on MACRO')

            mc.lb.set_tooltip('mc open       : '+ str.tostring(mc.o     , format.mintick) + 
                          '\nmc close      : '  + str.tostring(mc.cc    , format.mintick) + 
                          '\nmc top         : ' + str.tostring(mc.top   , format.mintick) +
                          '\nmc mid        : '  + str.tostring(mc.mid   , format.mintick) + 
                          '\nmc bottom   : '    + str.tostring(mc.bottom, format.mintick) )

            if mc.bottom < p.l1 and mc.top > p.h1
                if (mc.o < math.avg(mc.bottom, mc.mid) and mc.cc > math.avg(mc.top, mc.mid)) or (mc.o > math.avg(mc.top, mc.mid) and mc.cc < math.avg(mc.bottom, mc.mid))
                    mc.lf.set_color(color.new(eColor, 73))
                    if mcText != 'None'
                        mc.lb.set_text('Expansion ' + mc.lb.get_text())
                else
                    mc.lf.set_color(color.new(mColor, 73))
                    if mcText != 'None'
                        mc.lb.set_text('Manipulation ' + mc.lb.get_text())
            else if mc.bottom < p.l1 or mc.top > p.h1 
                if (mc.co > mc.mid and mc.cc < mc.mid) or (mc.co < mc.mid and mc.cc > mc.mid) or (mc.o < mc.mid and mc.cc < mc.mid) or (mc.o > mc.mid and mc.cc > mc.mid) // pL > pmcPL or pmcPH < pH
                    mc.lf.set_color(color.new(aColor, 73))
                    if mcText != 'None'
                        mc.lb.set_text('Accumulation ' + mc.lb.get_text())
                else
                    mc.lf.set_color(color.new(eColor, 73))
                    if mcText != 'None'
                        mc.lb.set_text('Expansion ' + mc.lb.get_text())
            else
                if p.l == p.l1 and p.h == p.h1 and (mc.o < math.avg(mc.bottom, mc.mid) and mc.cc > math.avg(mc.top, mc.mid)) or (mc.o > math.avg(mc.top, mc.mid) and mc.cc < math.avg(mc.bottom, mc.mid))

                    mc.lf.set_color(color.new(eColor, 73))
                    if mcText != 'None'
                        mc.lb.set_text('Expansion ' + mc.lb.get_text())
                else
                    mc.lf.set_color(color.new(aColor, 73))
                    if mcText != 'None' 
                        mc.lb.set_text('Accumulation ' + mc.lb.get_text())

//-----------------------------------------------------------------------------}
//Process macros
//-----------------------------------------------------------------------------{
if tf_m <= 5
    processMacro(m02330300,  7, 33, m02_top,  m02_bot, m02_mid, m02_ext, '02:33 AM - 03:00', '(UTC+00:00) LONDON'  , lnSummerTime, tf_m, mcAlert, mcAlertM)
    processMacro(m04030430,  9,  3, m04_top,  m04_bot, m04_mid, m04_ext, '04:03 AM - 04:30', '(UTC+00:00) LONDON'  , lnSummerTime, tf_m, mcAlert, mcAlertM)

    processMacro(m08500910,  8, 50, m08_top,  m08_bot, m08_mid, m08_ext, '08:50 AM - 09:10', '(UTC-05:00) NEW YORK', nySummerTime, tf_m, mcAlert, mcAlertM)
    processMacro(m09501010,  9, 50, m09_top,  m09_bot, m09_mid, m09_ext, '09:50 AM - 10:10', '(UTC-05:00) NEW YORK', nySummerTime, tf_m, mcAlert, mcAlertM)
    processMacro(m10501110, 10, 50, m10_top,  m10_bot, m10_mid, m10_ext, '10:50 AM - 11:10', '(UTC-05:00) NEW YORK', nySummerTime, tf_m, mcAlert, mcAlertM)
    processMacro(m11501210, 11, 50, m11_top,  m11_bot, m11_mid, m11_ext, '11:50 AM - 12:10', '(UTC-05:00) NEW YORK', nySummerTime, tf_m, mcAlert, mcAlertM)
    processMacro(m13101340, 13, 10, m13_top,  m13_bot, m13_mid, m13_ext, '01:10 PM - 01:40', '(UTC-05:00) NEW YORK', nySummerTime, tf_m, mcAlert, mcAlertM)
    processMacro(m15151545, 15, 15, m15_top,  m15_bot, m15_mid, m15_ext, '03:15 PM - 03:45', '(UTC-05:00) NEW YORK', nySummerTime, tf_m, mcAlert, mcAlertM)
else
    var table note = table.new(position.bottom_right, 1, 1)
    if barstate.islast
        table.cell(note, 0, 0, 'ICT Macros are supported on:\n 1 min, 3 mins and 5 mins charts\n\n', text_size=size.small, text_color=chart.fg_color)

//-----------------------------------------------------------------------------}