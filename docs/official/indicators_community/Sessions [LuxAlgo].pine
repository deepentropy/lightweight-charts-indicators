// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Sessions [LuxAlgo]", "LuxAlgo - Sessions", overlay = true, max_bars_back = 500, max_lines_count = 500, max_boxes_count = 500, max_labels_count = 500)
//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
//Session A
show_sesa = input(true, '', inline = 'sesa', group = 'Session A')
sesa_txt = input('New York', '', inline = 'sesa', group = 'Session A')
sesa_ses = input.session('1300-2200', '', inline = 'sesa', group = 'Session A')
sesa_css = input.color(#ff5d00, '', inline = 'sesa', group = 'Session A')

sesa_range = input(true, 'Range', inline = 'sesa_overlays', group = 'Session A')
sesa_tl = input(false, 'Trendline', inline = 'sesa_overlays', group = 'Session A')
sesa_avg = input(false, 'Mean', inline = 'sesa_overlays', group = 'Session A')
sesa_vwap = input(false, 'VWAP', inline = 'sesa_overlays', group = 'Session A')
sesa_maxmin = input(false, 'Max/Min', inline = 'sesa_overlays', group = 'Session A')

//Session B
show_sesb = input(true, '', inline = 'sesb', group = 'Session B')
sesb_txt = input('London', '', inline = 'sesb', group = 'Session B')
sesb_ses = input.session('0700-1600', '', inline = 'sesb', group = 'Session B')
sesb_css = input.color(#2157f3, '', inline = 'sesb', group = 'Session B')

sesb_range = input(true, 'Range', inline = 'sesb_overlays', group = 'Session B')
sesb_tl = input(false, 'Trendline', inline = 'sesb_overlays', group = 'Session B')
sesb_avg = input(false, 'Mean', inline = 'sesb_overlays', group = 'Session B')
sesb_vwap = input(false, 'VWAP', inline = 'sesb_overlays', group = 'Session B')
sesb_maxmin = input(false, 'Max/Min', inline = 'sesb_overlays', group = 'Session B')

//Session C
show_sesc = input(true, '', inline = 'sesc', group = 'Session C')
sesc_txt = input('Tokyo', '', inline = 'sesc', group = 'Session C')
sesc_ses = input.session('0000-0900', '', inline = 'sesc', group = 'Session C')
sesc_css = input.color(#e91e63, '', inline = 'sesc', group = 'Session C')

sesc_range = input(true, 'Range', inline = 'sesc_overlays', group = 'Session C')
sesc_tl = input(false, 'Trendline', inline = 'sesc_overlays', group = 'Session C')
sesc_avg = input(false, 'Mean', inline = 'sesc_overlays', group = 'Session C')
sesc_vwap = input(false, 'VWAP', inline = 'sesc_overlays', group = 'Session C')
sesc_maxmin = input(false, 'Max/Min', inline = 'sesc_overlays', group = 'Session C')

//Session D
show_sesd = input(true, '', inline = 'sesd', group = 'Session D')
sesd_txt = input('Sydney', '', inline = 'sesd', group = 'Session D')
sesd_ses = input.session('2100-0600', '', inline = 'sesd', group = 'Session D')
sesd_css = input.color(#ffeb3b, '', inline = 'sesd', group = 'Session D')

sesd_range = input(true, 'Range', inline = 'sesd_overlays', group = 'Session D')
sesd_tl = input(false, 'Trendline', inline = 'sesd_overlays', group = 'Session D')
sesd_avg = input(false, 'Mean', inline = 'sesd_overlays', group = 'Session D')
sesd_vwap = input(false, 'VWAP', inline = 'sesd_overlays', group = 'Session D')
sesd_maxmin = input(false, 'Max/Min', inline = 'sesd_overlays', group = 'Session D')

//Timezones
tz_incr = input.int(0, 'UTC (+/-)', group = 'Timezone')
use_exchange = input(false, 'Use Exchange Timezone', group = 'Timezone')

//Ranges Options
bg_transp = input.float(90, 'Range Area Transparency', group = 'Ranges Settings')
show_outline = input(true, 'Range Outline', group = 'Ranges Settings')
show_txt = input(true, 'Range Label', group = 'Ranges Settings')

//Dashboard
show_dash = input(false, 'Show Dashboard', group   = 'Dashboard')
advanced_dash = input(false, 'Advanced Dashboard', group = 'Dashboard')
dash_loc = input.string('Top Right', 'Dashboard Location', options = ['Top Right', 'Bottom Right', 'Bottom Left'], group   = 'Dashboard')
text_size = input.string('Small', 'Dashboard Size', options = ['Tiny', 'Small', 'Normal'], group   = 'Dashboard')

//Divider
show_ses_div = input(false, 'Show Sessions Divider', group = 'Dividers')
show_day_div = input(true, 'Show Daily Divider', group = 'Dividers')

//-----------------------------------------------------------------------------}
//Functions
//-----------------------------------------------------------------------------{
n = bar_index

//Get session average
get_avg(session)=>
    var len = 1
    var float csma = na
    var float sma = na

    if session > session[1]
        len := 1
        csma := close
    
    if session and session == session[1]
        len += 1    
        csma += close
        sma := csma / len
    
    sma

//Get trendline coordinates
get_linreg(session)=>
    var len = 1
    var float cwma  = na
    var float csma  = na
    var float csma2 = na

    var float y1 = na
    var float y2 = na
    var float stdev = na 
    var float r2    = na 

    if session > session[1]
        len   := 1
        cwma  := close
        csma  := close
        csma2 := close * close
    
    if session and session == session[1]
        len   += 1    
        csma  += close
        csma2 += close * close
        cwma  += close * len

        sma = csma / len
        wma = cwma / (len * (len + 1) / 2)

        cov   = (wma - sma) * (len+1)/2
        stdev := math.sqrt(csma2 / len - sma * sma)
        r2    := cov / (stdev * (math.sqrt(len*len - 1) / (2 * math.sqrt(3))))

        y1 := 4 * sma - 3 * wma
        y2 := 3 * wma - 2 * sma

    [y1 , y2, stdev, r2]

//Session Vwap
get_vwap(session) =>
    var float num = na
    var float den = na

    if session > session[1]
        num := close * volume
        den := volume
    
    else if session and session == session[1]
        num += close * volume
        den += volume
    else
        num := na

    [num, den]

//Set line
set_line(session, y1, y2, session_css)=>
    var line tl = na

    if session > session[1]
        tl := line.new(n, close, n, close, color = session_css)

    if session and session == session[1]
        line.set_y1(tl, y1)
        line.set_xy2(tl, n, y2)

//Set session range
get_range(session, session_name, session_css)=>
    var t = 0 
    var max = high
    var min = low
    var box bx = na
    var label lbl = na 
    
    if session > session[1]
        t := time
        max := high
        min := low

        bx := box.new(n, max, n, min
          , bgcolor = color.new(session_css, bg_transp)
          , border_color = show_outline ? session_css : na
          , border_style = line.style_dotted)

        if show_txt
            lbl := label.new(t, max, session_name
              , xloc = xloc.bar_time
              , textcolor = session_css
              , style = label.style_label_down
              , color = color.new(color.white, 100)
              , size = size.tiny)

    if session and session == session[1]
        max := math.max(high, max)
        min := math.min(low, min)

        box.set_top(bx, max)
        box.set_rightbottom(bx, n, min)

        if show_txt
            label.set_xy(lbl, int(math.avg(t, time)), max)
    
    [session ? na : max, session ? na : min]

//-----------------------------------------------------------------------------}
//Sessions
//-----------------------------------------------------------------------------{
tf = timeframe.period

var tz = use_exchange ? syminfo.timezone :
  str.format('UTC{0}{1}', tz_incr >= 0 ? '+' : '-', math.abs(tz_incr))

is_sesa = math.sign(nz(time(tf, sesa_ses, tz)))
is_sesb = math.sign(nz(time(tf, sesb_ses, tz)))
is_sesc = math.sign(nz(time(tf, sesc_ses, tz)))
is_sesd = math.sign(nz(time(tf, sesd_ses, tz)))

//-----------------------------------------------------------------------------}
//Dashboard
//-----------------------------------------------------------------------------{
var table_position = dash_loc == 'Bottom Left' ? position.bottom_left 
  : dash_loc == 'Top Right' ? position.top_right 
  : position.bottom_right

var table_size = text_size == 'Tiny' ? size.tiny 
  : text_size == 'Small' ? size.small 
  : size.normal

var tb = table.new(table_position, 5, 6
  , bgcolor = #1e222d
  , border_color = #373a46
  , border_width = 1
  , frame_color = #373a46
  , frame_width = 1)

if barstate.isfirst and show_dash
    table.cell(tb, 0, 0, 'LuxAlgo', text_color = color.white, text_size = table_size)
    table.merge_cells(tb, 0, 0, 4, 0)

    table.cell(tb, 0, 2, sesa_txt, text_color = sesa_css, text_size = table_size)
    table.cell(tb, 0, 3, sesb_txt, text_color = sesb_css, text_size = table_size)
    table.cell(tb, 0, 4, sesc_txt, text_color = sesc_css, text_size = table_size)
    table.cell(tb, 0, 5, sesd_txt, text_color = sesd_css, text_size = table_size)

    if advanced_dash
        table.cell(tb, 0, 1, 'Session', text_color = color.white
          , text_size = table_size)
        
        table.cell(tb, 1, 1, 'Status', text_color = color.white
          , text_size = table_size)
        
        table.cell(tb, 2, 1, 'Trend', text_color = color.white
          , text_size = table_size)
        
        table.cell(tb, 3, 1, 'Volume', text_color = color.white
          , text_size = table_size)
        
        table.cell(tb, 4, 1, 'σ', text_color = color.white
          , text_size = table_size)

if barstate.islast and show_dash
    table.cell(tb, 1, 2, is_sesa ? 'Active' : 'Innactive'
      , bgcolor = is_sesa ? #089981 : #f23645
      , text_color = color.white
      , text_size = table_size)
    
    table.cell(tb, 1, 3, is_sesb ? 'Active' : 'Innactive'
      , bgcolor = is_sesb ? #089981 : #f23645
      , text_color = color.white
      , text_size = table_size)
    
    table.cell(tb, 1, 4, is_sesc ? 'Active' : 'Innactive'
      , bgcolor = is_sesc ? #089981 : #f23645
      , text_color = color.white
      , text_size = table_size)
    
    table.cell(tb, 1, 5, is_sesd ? 'Active' : 'Innactive'
      , bgcolor = is_sesd ? #089981 : #f23645
      , text_color = color.white
      , text_size = table_size)

//-----------------------------------------------------------------------------}
//Overlays
//-----------------------------------------------------------------------------{
var float max_sesa = na
var float min_sesa = na
var float max_sesb = na
var float min_sesb = na
var float max_sesc = na
var float min_sesc = na
var float max_sesd = na
var float min_sesd = na

//Ranges
if show_sesa and sesa_range
    [max, min] = get_range(is_sesa, sesa_txt, sesa_css)
    max_sesa := max
    min_sesa := min

if show_sesb and sesb_range
    [max, min] = get_range(is_sesb, sesb_txt, sesb_css)
    max_sesb := max
    min_sesb := min

if show_sesc and sesc_range
    [max, min] = get_range(is_sesc, sesc_txt, sesc_css)
    max_sesc := max
    min_sesc := min

if show_sesd and sesd_range
    [max, min] = get_range(is_sesd, sesd_txt, sesd_css)
    max_sesd := max
    min_sesd := min

//Trendlines
if show_sesa and (sesa_tl or advanced_dash)
    [y1, y2, stdev, r2] = get_linreg(is_sesa)

    if advanced_dash
        table.cell(tb, 2, 2, str.tostring(r2, '#.##')
          , bgcolor = r2 > 0 ? #089981 : #f23645
          , text_color = color.white
          , text_size = table_size)
        
        table.cell(tb, 4, 2, str.tostring(stdev, '#.####')
          , text_color = color.white
          , text_size = table_size)
        
    if sesa_tl
        set_line(is_sesa, y1, y2, sesa_css)

if show_sesb and (sesb_tl or advanced_dash)
    [y1, y2, stdev, r2] = get_linreg(is_sesb)
    
    if advanced_dash
        table.cell(tb, 2, 3, str.tostring(r2, '#.##')
          , bgcolor = r2 > 0 ? #089981 : #f23645
          , text_color = color.white
          , text_size = table_size)

        table.cell(tb, 4, 3, str.tostring(stdev, '#.####')
          , text_color = color.white
          , text_size = table_size)
        
    if sesb_tl
        set_line(is_sesb, y1, y2, sesb_css)

if show_sesc and (sesc_tl or advanced_dash)
    [y1, y2, stdev, r2] = get_linreg(is_sesc)
    
    if advanced_dash
        table.cell(tb, 2, 4, str.tostring(r2, '#.##')
          , bgcolor = r2 > 0 ? #089981 : #f23645
          , text_color = color.white
          , text_size = table_size)

        table.cell(tb, 4, 4, str.tostring(stdev, '#.####')
          , text_color = color.white
          , text_size = table_size)
        
    if sesc_tl
        set_line(is_sesc, y1, y2, sesc_css)

if show_sesd and (sesd_tl or advanced_dash)
    [y1, y2, stdev, r2] = get_linreg(is_sesd)
    
    if advanced_dash
        table.cell(tb, 2, 5, str.tostring(r2, '#.##')
          , bgcolor = r2 > 0 ? #089981 : #f23645
          , text_color = color.white
          , text_size = table_size)
        
        table.cell(tb, 4, 5, str.tostring(stdev, '#.####')
          , text_color = color.white
          , text_size = table_size)
        
    if sesd_tl
        set_line(is_sesd, y1, y2, sesd_css)

//Mean
if show_sesa and sesa_avg
    avg = get_avg(is_sesa)
    set_line(is_sesa, avg, avg, sesa_css)

if show_sesb and sesb_avg
    avg = get_avg(is_sesb)
    set_line(is_sesb, avg, avg, sesb_css)

if show_sesc and sesc_avg
    avg = get_avg(is_sesc)
    set_line(is_sesc, avg, avg, sesc_css)

if show_sesd and sesd_avg
    avg = get_avg(is_sesd)
    set_line(is_sesd, avg, avg, sesd_css)

//VWAP
var float vwap_a = na
var float vwap_b = na
var float vwap_c = na
var float vwap_d = na

if show_sesa and (sesa_vwap or advanced_dash)
    [num, den] = get_vwap(is_sesa)

    if sesa_vwap
        vwap_a := num / den

    if advanced_dash
        table.cell(tb, 3, 2, str.tostring(den, format.volume)
          , text_color = color.white
          , text_size = table_size)

if show_sesb and (sesb_vwap or advanced_dash)
    [num, den] = get_vwap(is_sesb)

    if sesb_vwap
        vwap_b := num / den

    if advanced_dash
        table.cell(tb, 3, 3, str.tostring(den, format.volume)
          , text_color = color.white
          , text_size = table_size)

if show_sesc and (sesc_vwap or advanced_dash)
    [num, den] = get_vwap(is_sesc)

    if sesc_vwap
        vwap_c := num / den

    if advanced_dash
        table.cell(tb, 3, 4, str.tostring(den, format.volume)
          , text_color = color.white
          , text_size = table_size)

if show_sesd and (sesd_vwap or advanced_dash)
    [num, den] = get_vwap(is_sesd)

    if sesd_vwap
        vwap_d := num / den

    if advanced_dash
        table.cell(tb, 3, 5, str.tostring(den, format.volume)
          , text_color = color.white
          , text_size = table_size)

//-----------------------------------------------------------------------------}
//Plots
//-----------------------------------------------------------------------------{
//Plot max/min
plot(sesa_maxmin ? max_sesa : na, 'Session A Maximum', sesa_css, 1, plot.style_linebr)
plot(sesa_maxmin ? min_sesa : na, 'Session A Minimum', sesa_css, 1, plot.style_linebr)

plot(sesb_maxmin ? max_sesb : na, 'Session B Maximum', sesb_css, 1, plot.style_linebr)
plot(sesb_maxmin ? min_sesb : na, 'Session B Minimum', sesb_css, 1, plot.style_linebr)

plot(sesc_maxmin ? max_sesc : na, 'Session C Maximum', sesc_css, 1, plot.style_linebr)
plot(sesc_maxmin ? min_sesc : na, 'Session C Minimum', sesc_css, 1, plot.style_linebr)

plot(sesd_maxmin ? max_sesd : na, 'Session D Maximum', sesd_css, 1, plot.style_linebr)
plot(sesd_maxmin ? min_sesd : na, 'Session D Minimum', sesd_css, 1, plot.style_linebr)

//Plot vwaps
plot(vwap_a, 'Session A VWAP', sesa_css, 1, plot.style_linebr)
plot(vwap_b, 'Session B VWAP', sesb_css, 1, plot.style_linebr)
plot(vwap_c, 'Session C VWAP', sesc_css, 1, plot.style_linebr)
plot(vwap_d, 'Session D VWAP', sesd_css, 1, plot.style_linebr)

//Plot Divider A
plotshape(is_sesa and show_ses_div and show_sesa, "·"
  , shape.square
  , location.bottom
  , na
  , text = "."
  , textcolor = sesa_css
  , size = size.tiny
  , display = display.all - display.status_line
  , editable = false)

plotshape(is_sesa != is_sesa[1] and show_ses_div and show_sesa, "NYE"
  , shape.labelup
  , location.bottom
  , na
  , text = "❚"
  , textcolor = sesa_css
  , size = size.tiny
  , display = display.all - display.status_line
  , editable = false)

//Plot Divider B
plotshape(is_sesb and show_ses_div and show_sesb, "·"
  , shape.labelup
  , location.bottom
  , na
  , text = "."
  , textcolor = sesb_css
  , size = size.tiny
  , display = display.all - display.status_line
  , editable = false)

plotshape(is_sesb != is_sesb[1] and show_ses_div and show_sesb, "LDN"
  , shape.labelup
  , location.bottom
  , na
  , text = "❚"
  , textcolor = sesb_css
  , size = size.tiny
  , display = display.all - display.status_line
  , editable = false)

//Plot Divider C
plotshape(is_sesc and show_ses_div and show_sesc, "·"
  , shape.square
  , location.bottom
  , na
  , text = "."
  , textcolor = sesc_css
  , size = size.tiny
  , display = display.all - display.status_line
  , editable = false)

plotshape(is_sesc != is_sesc[1] and show_ses_div and show_sesc, "TYO"
  , shape.labelup
  , location.bottom
  , na
  , text = "❚"
  , textcolor = sesc_css
  , size = size.tiny
  , display = display.all - display.status_line
  , editable = false)

//Plot Divider D
plotshape(is_sesd and show_ses_div and show_sesd, "·"
  , shape.labelup
  , location.bottom
  , na
  , text = "."
  , textcolor = sesd_css
  , size = size.tiny
  , display = display.all - display.status_line
  , editable = false)

plotshape(is_sesd != is_sesd[1] and show_ses_div and show_sesd, "SYD"
  , shape.labelup
  , location.bottom
  , na
  , text = "❚"
  , textcolor = sesd_css
  , size = size.tiny
  , display = display.all - display.status_line
  , editable = false)

//-----------------------------------------------------------------------------}
//Plots daily dividers
//-----------------------------------------------------------------------------{
day = dayofweek

if day != day[1] and show_day_div
    line.new(n, close + syminfo.mintick, n, close - syminfo.mintick
      , color  = color.gray
      , extend = extend.both
      , style  = line.style_dashed)

plotshape(day != day[1] and day == 1 and show_day_div, "Sunday"
  , shape.labeldown
  , location.top
  , na
  , text = "Sunday"
  , textcolor = color.gray
  , size = size.tiny
  , display = display.all - display.status_line
  , editable = false)

plotshape(day != day[1] and day == 2 and show_day_div, "Monday"
  , shape.labeldown
  , location.top
  , na
  , text = "Monday"
  , textcolor = color.gray
  , size = size.tiny
  , display = display.all - display.status_line
  , editable = false)

plotshape(day != day[1] and day == 3 and show_day_div, "Tuesday"
  , shape.labeldown
  , location.top
  , na
  , text = "Tuesday"
  , textcolor = color.gray
  , size = size.tiny
  , display = display.all - display.status_line
  , editable = false)

plotshape(day != day[1] and day == 4 and show_day_div, "Wednesay"
  , shape.labeldown
  , location.top
  , na
  , text = "Wednesday"
  , textcolor = color.gray
  , size = size.tiny
  , display = display.all - display.status_line
  , editable = false)

plotshape(day != day[1] and day == 5 and show_day_div, "Thursday"
  , shape.labeldown
  , location.top
  , na
  , text = "Thursday"
  , textcolor = color.gray
  , size = size.tiny
  , display = display.all - display.status_line
  , editable = false)

plotshape(day != day[1] and day == 6 and show_day_div, "Friday"
  , shape.labeldown
  , location.top
  , na
  , text = "Friday"
  , textcolor = color.gray
  , size = size.tiny
  , display = display.all - display.status_line
  , editable = false)

plotshape(day != day[1] and day == 7 and show_day_div, "Saturday"
  , shape.labeldown
  , location.top
  , na
  , text = "Saturday"
  , textcolor = color.gray
  , size = size.tiny
  , display = display.all - display.status_line
  , editable = false)

//-----------------------------------------------------------------------------}