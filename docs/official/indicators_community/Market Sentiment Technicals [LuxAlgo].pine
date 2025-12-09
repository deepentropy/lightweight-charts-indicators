// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo
//@version=5

indicator('Market Sentiment Technicals [LuxAlgo]', 'LuxAlgo - Market Sentiment Technicals', true, scale = scale.none)

//---------------------------------------------------------------------------------------------------------------------
// Settings 
//---------------------------------------------------------------------------------------------------------------------{

display  = display.all - display.status_line

genericGroup = 'Generic Settings'

tfTTip   = 'This option is utilized to calculate technical indicators for higher timeframes. If a timeframe lower than the chart\'s timeframe is selected, calculations will be based on the chart\'s timeframe.'
indi_tf  = input.string('Chart', 'Timeframe', options = ['Chart', '5 Minutes', '15 Minutes', '1 Hour', '4 Hours', '1 Day', '1 Week', '1 Month'], group = genericGroup, display = display, tooltip = tfTTip)
hOffset  = input.int(17, 'Horizontal Offset', minval = 10, maxval = 360, group = genericGroup, display = display)

bullColor = input.color(#085def, 'Gradient Colors: Bullish', inline = 'CSS', group = genericGroup)
bearColor = input.color(#f10707, 'Bearish', inline = 'CSS', group = genericGroup)

panel_Group  = 'Indicators Sentiment Panel'
panel_Show   = input.bool(true, 'Indicators Sentiment Panel', group = panel_Group)
panel_Height = input.int(3, '  Panel Height', minval = 2, maxval = 7, group = panel_Group, display = display)

mrktMtr_Show = input.bool(true, 'Market Sentiment Meter', group = 'Market Sentiment Meter')

mrktOsc_Group      = 'Market Sentiment Oscillator'
mrktOsc_Show       = input.bool(true, 'Market Sentiment Oscillator', group = mrktOsc_Group)
mrktOsc_Divergence = input.string('None', "  Show Divergence", options = ['Regular', 'Hidden', 'All', 'None'], group = mrktOsc_Group, display = display)
mrktOsc_lnWidth    = input.int(1, '  Oscillator Line Width', minval = 1, group = mrktOsc_Group, display = display)
mrktOsc_height     = input.float(3.5, '  Oscillator Height',  minval = 0, step = .5, group = mrktOsc_Group, display = display)

rsi_Group  = 'Relative Strength Index Settings'
rsi_Source = input.source(close, '  Source', group = rsi_Group, display = display)
rsi_Length = input.int(14, '  Length', minval = 1, group = rsi_Group, display = display)

stoch_Group   = 'Stochastic %K Settings'
stoch_LengthK = input.int(14, '  Stochastic %K Length', minval = 1, group = stoch_Group, display = display)
stoch_SmoothK = input.int(3, '  %K Smoothing', minval = 1, group = stoch_Group, display = display)

stochRSI_Group     = 'Stochastic RSI Fast Settings'
stochRSI_LengthK   = input.int(14, '  Stochastic Length', minval = 1, group = stochRSI_Group, display = display)
stochRSI_SmoothK   = input.int(3 , '  %K Smoothing', minval = 1, group = stochRSI_Group, display = display)
stochRSI_SourceRSI = input.source(close, '  RSI Source', group = stochRSI_Group, display = display)
stochRSI_LengthRSI = input.int(14, '  RSI Length', minval = 1, group = stochRSI_Group, display = display)

cci_Group  = 'Commodity Channel Index Settings'
cci_Source = input.source(hlc3, '  Source', group = cci_Group, display = display)
cci_Length = input.int(20, '  Length', minval = 1, group = cci_Group, display = display)

bbp_Group  = 'Bull Bear Power Settings'
bbp_Length = input.int(13, '  Length', minval = 1, group = bbp_Group, display = display)

ma_Group  = 'MA Settings'
maType    = input.string("SMA", "  Type", options = ["SMA", "EMA", "HMA", "RMA", "WMA", "VWMA"], group = ma_Group, display = display)
maLength  = input.int(20, '  Length', minval = 1, group = ma_Group, display = display)

vwap_Group = 'VWAP Settings'
vwapAnchor = input.string('Auto', '  Anchor', options = ['Auto', 'Day', 'Week', 'Month', 'Quarter', 'Year'], group = vwap_Group, display = display)
vwapStDev  = input.float(2, '  StdDev', minval = 1, group = vwap_Group, display = display)

bb_Group  = 'Bollinger Bands Settings'
bb_Type   = input.string("SMA", "  Basis Type", options = ["SMA", "EMA", "HMA", "RMA", "WMA", "VWMA"], group = bb_Group, display = display)
bb_Source = input.source(close, "  Source", group = bb_Group, display = display)
bb_Length = input.int(20, "  Length", minval = 1, group = bb_Group, display = display)
bb_Mult   = input.float(2.0, "  StdDev", minval=0.01, maxval=50, group = bb_Group, display = display)

st_Group  = 'Supertrend Settings'
st_Period = input.int(10, '  ATR Length', minval=1, group = st_Group, display = display)
st_Factor = input.float(3, '  Factor', minval = 2, step = 0.1, group = st_Group, display = display)

lr_Group  = 'Linear Regression Settings'
lr_Source = input.source(close, "  Source", group = lr_Group, display = display)
lr_Length = input.int(25, "  Length", minval = 1, group = lr_Group, display = display)

ms_Group  = 'Market Structure Settings'
ms_Length = input.int(5, "  Length", minval = 1, group = ms_Group, display = display)

norm_Group  = 'Normalization Settings - Trend Indicators'
norm_Smooth = input.int(3, '  Smoothing', minval = 1, group = norm_Group, display = display)

//---------------------------------------------------------------------------------------------------------------------}
// User Defined Types
//---------------------------------------------------------------------------------------------------------------------{

type panel
    box         []  tiValues
    label       []  tiTitles

//---------------------------------------------------------------------------------------------------------------------}
// Variables
//---------------------------------------------------------------------------------------------------------------------{

var meterLines = array.new_line()
circulus = array.new<chart.point>(0)
var meterLabels = array.new_label()

//---------------------------------------------------------------------------------------------------------------------}
// Functions / Methods
//---------------------------------------------------------------------------------------------------------------------{

timeframe(timeframe) =>
    float chartTFinM = timeframe.in_seconds() / 60

    switch 
        timeframe == "5 Minutes"  and chartTFinM <= 5   => '5'
        timeframe == "15 Minutes" and chartTFinM <= 15  => '15'
        timeframe == "1 Hour"     and chartTFinM <= 60  => '60'
        timeframe == "4 Hours"    and chartTFinM <= 240 => '240'
        timeframe == "1 Day"      and timeframe.isintraday => 'D'
        timeframe == "1 Week"     and (timeframe.isdaily or timeframe.isintraday) => 'W'
        timeframe == "1 Month"    and (timeframe.isweekly or timeframe.isdaily or timeframe.isintraday) => 'M'
        => timeframe.period

timeframeText(timeframe) =>
    timeframeX = timeframe(timeframe)

    if not str.contains(timeframeX, "D") and not str.contains(timeframeX, "W") and not str.contains(timeframeX, "M") and not str.contains(timeframeX, "S")
        TFinNUM = str.tonumber(timeframeX)
        if TFinNUM < 60
            timeframeX + 'm'
        else
            str.tostring(TFinNUM / 60) + 'H'
    else
        timeframeX

autoAnchor(anchor) =>
    if anchor == 'Auto'
        if timeframe.isintraday
            timeframe.multiplier <= 15 ? 'D' : 'W'
        else if timeframe.isdaily
            'M'
        else if timeframe.isweekly
            '3M'
        else if timeframe.ismonthly
            '12M'
    else if anchor == 'Day'
        'D'
    else if anchor == 'Week'
        'W'
    else if anchor == 'Month'
        'M'
    else if anchor == 'Quarter'
        '3M'
    else if anchor == 'Year'
        '12M'

syminfo(symbol) =>
    symbol != '' ? str.substring(ticker.standard(symbol), str.pos(ticker.standard(symbol), ":") + 1) : syminfo.ticker

interpolate(value, valueHigh, valueLow, rangeHigh, rangeLow) =>
    rangeLow + (value - valueLow) * (rangeHigh - rangeLow) / (valueHigh - valueLow)

normalize(buy, sell, smooth)=>
    var os = 0
    var float max = na
    var float min = na
    os := buy ? 1 : sell ? -1 : os
    
    max := os > os[1] ? close : os < os[1] ? max : math.max(close, max)
    min := os < os[1] ? close : os > os[1] ? min : math.min(close, min)

    ta.sma((close - min)/(max - min), smooth) * 100

movingAverageValue(source, length, maType) => 
    switch maType
        "SMA"  => ta.sma (source, length)
        "EMA"  => ta.ema (source, length)
        "HMA"  => ta.hma (source, length)
        "RMA"  => ta.rma (source, length)
        "WMA"  => ta.wma (source, length)
        "VWMA" => ta.vwma(source, length)
        
rsi(source, length) =>
    rsi = ta.rsi(source, length)

    switch
        rsi > 70 => interpolate(rsi, 100, 70, 100, 75)
        rsi > 50 => interpolate(rsi, 70 , 50, 75 , 50)
        rsi > 30 => interpolate(rsi, 50 , 30, 50 , 25)
        rsi >= 0 => interpolate(rsi, 30 ,  0, 25 ,  0)

stochastic(lengthK, smoothK) =>
    stoch = ta.sma(ta.stoch(close, high, low, lengthK), smoothK)

    switch
        stoch > 80 => interpolate(stoch, 100, 80, 100, 75)
        stoch > 50 => interpolate(stoch, 80 , 50, 75 , 50)
        stoch > 20 => interpolate(stoch, 50 , 20, 50 , 25)
        stoch >= 0 => interpolate(stoch, 20 ,  0, 25 ,  0)

stochastic(rsiSource, rsiLength, stochLengthK, stochSmoothK) =>
    rsi = ta.rsi(rsiSource, rsiLength)
    stoch = ta.sma(ta.stoch(rsi, rsi, rsi, stochLengthK), stochSmoothK)

    switch
        stoch > 80 => interpolate(stoch, 100, 80, 100, 75)
        stoch > 50 => interpolate(stoch, 80 , 50, 75 , 50)
        stoch > 20 => interpolate(stoch, 50 , 20, 50 , 25)
        stoch >= 0 => interpolate(stoch, 20 ,  0, 25 ,  0)

cci(source, length) =>
    ma = ta.sma(source, length)
    cci = (source - ma) / (0.015 * ta.dev(source, length))

    switch
        cci > 100  => cci > 300 ? 100 : interpolate(cci, 300, 100, 100, 75)
        cci >= 0   => interpolate(cci, 100, 0, 75, 50)
        cci < -100 => cci < -300 ? 0 :  interpolate(cci, -100, -300, 25, 0)
        cci < 0    => interpolate(cci, 0, -100, 50, 25)

bullBearPower(length) => 
    bbp = high + low - 2 * movingAverageValue(close, length, 'EMA')
    [_, upper, lower] = ta.bb(bbp, 100, 2)

    switch
        bbp > upper => bbp > 1.5 * upper ? 100 : interpolate(bbp, 1.5 * upper, upper, 100, 75)
        bbp > 0 => interpolate(bbp, upper, 0, 75 , 50)
        bbp < lower => bbp < 1.5 * lower ? 0 : interpolate(bbp, lower, 1.5 * lower, 25, 0) 
        bbp < 0 => interpolate(bbp, 0, lower, 50 , 25)

movingAverage(source, length, maType) => 
    basis = movingAverageValue(source, length, maType)

    normalize(close > basis, close < basis, norm_Smooth)

bollingerBands(source, length, multiplier, maType) =>
    basis = movingAverageValue(source, length, maType)
    deviation = multiplier * ta.stdev(source, length)

    normalize(close > basis + deviation, close < basis - deviation, norm_Smooth)

supertrend(factor, period) =>
    [supertrend1, direction1] = ta.supertrend(factor, period)

    normalize(close > supertrend1, close < supertrend1, norm_Smooth)

vwapBands(source, anchor, stdev)=>
    [_, upper, lower] = ta.vwap(source, timeframe.change(autoAnchor(anchor)), stdev)

    normalize(close > upper, close < lower, norm_Smooth)

linearRegression(source, length) =>
    50 * ta.correlation(source, bar_index, length) + 50

marketStructure(length) => 
    var float ph_y = na
    var float pl_y = na
    var ph_cross = false, var pl_cross = false

    bull = false
    bear = false

    ph = ta.pivothigh(length, length)
    pl = ta.pivotlow (length, length)

    if not na(ph)
        ph_y := ph
        ph_cross := false

    if not na(pl) 
        pl_y := pl
        pl_cross := false

    if close > ph_y and not ph_cross
        ph_cross := true
        bull := true

    if close < pl_y and not pl_cross
        pl_cross := true
        bear := true

    normalize(bull, bear, norm_Smooth)


collectData(timeframe) =>

    request.security(syminfo.tickerid, timeframe, 
         [close,
         rsi(rsi_Source, rsi_Length), 
         stochastic(stoch_LengthK, stoch_SmoothK),
         stochastic(stochRSI_SourceRSI, stochRSI_LengthRSI, stochRSI_LengthK, stochRSI_SmoothK), 
         cci(cci_Source, cci_Length),
         bullBearPower(bbp_Length),
         movingAverage(close, maLength, maType),
         vwapBands(close, vwapAnchor, vwapStDev),
         bollingerBands(bb_Source, bb_Length, bb_Mult, bb_Type),
         supertrend(st_Factor, st_Period),
         linearRegression(lr_Source, lr_Length),
         marketStructure(ms_Length)
     ])


processData(show, timeframe, closeValue, rsiValue, stochValue, stochRSIValue, cciValue, bbpValue, maValue, vwapValue, bbValue, stValue, regValue, msValue, sentiment, offset, size) => 

    if show
        var panel tiPanel = 
             panel.new(
                 array.new<box>(na), 
                 array.new<label>(na)
             )

        if tiPanel.tiValues.size() > 0
            for i = 0 to tiPanel.tiValues.size() - 1
                box.delete(tiPanel.tiValues.shift())

        if tiPanel.tiTitles.size() > 0
            for i = 0 to tiPanel.tiTitles.size() - 1
                label.delete(tiPanel.tiTitles.shift())

        oscIndies = array.from(rsiValue, stochValue, stochRSIValue, cciValue, bbpValue)
        oscNames  = array.from('R\nS\nI', '%\nK', 'S\nT\nR\nS\nI', 'C\nC\nI', 'B\nB\nP')
        oscTitles = array.from('Relative Strength Index (RSI)', 'Stochastic %K', 'Stochastic RSI %K', 'Commodity Channel Index', 'Bull Bear Power')

        trendIndies = array.from(maValue, vwapValue, bbValue, stValue, regValue, msValue)
        trendNames  = array.from('M\nA', 'V\nW\nA\nP', 'B\nB', 'S\nT', 'R\nE\nG', 'M\nS')
        trendTitles = array.from(str.format('Moving Average ({0} {1})', maType, maLength), 'Volume Weighted Average Price', 'Bollinger Bands', 'Supertrend', 'Linear Regression', 'Market Structure')

        pSize = oscIndies.size() + trendIndies.size()

        tiPanel.tiTitles.push(label.new(
             hOffset + bar_index + int((3 * (pSize + 1) - 1) / 2), size + offset + .5, 
             syminfo(syminfo.tickerid) + ' (' + str.tostring(closeValue) + ') · ' + timeframeText(timeframe), 
             color = color(na), style = label.style_label_down, textcolor = chart.fg_color))

        tiPanel.tiTitles.push(label.new(
             hOffset + bar_index, interpolate(75, 100, 0, size, 0) + offset, 'Overbought', 
             color = color(na), style = label.style_label_right, textcolor = bullColor))

        tiPanel.tiTitles.push(label.new(
             hOffset + bar_index, interpolate(50, 100, 0, size, 0) + offset, 'Neutral', 
             color = color(na), style = label.style_label_right, textcolor = #787b86))

        tiPanel.tiTitles.push(label.new(
             hOffset + bar_index, interpolate(25, 100, 0, size, 0) + offset, 'Oversold', 
             color = color(na), style = label.style_label_right, textcolor = bearColor))

        tiPanel.tiTitles.push(label.new(
             hOffset + bar_index + 3 * (pSize + 1), interpolate(75, 100, 0, size, 0) + offset, 'Strong Bullish Trend', 
             color = color(na), style = label.style_label_left, textcolor = bullColor))

        tiPanel.tiTitles.push(label.new(
             hOffset + bar_index + 3 * (pSize + 1), interpolate(50, 100, 0, size, 0) + offset, 'Trendless', 
             color = color(na), style = label.style_label_left, textcolor = #787b86))

        tiPanel.tiTitles.push(label.new(
             hOffset + bar_index + 3 * (pSize + 1), interpolate(25, 100, 0, size, 0) + offset, 'Strong Bearish Trend', 
             color = color(na), style = label.style_label_left, textcolor = bearColor))

        tiPanel.tiValues.push(box.new(
             hOffset + bar_index - 1 , offset + interpolate(75, 100, 0, size, 0), 
             hOffset + bar_index + 3 * (pSize + 1) , offset + interpolate(75, 100, 0, size, 0),
             color.new(bullColor, 50), bgcolor = bullColor ))

        tiPanel.tiValues.push(box.new(
             hOffset + bar_index - 1 , offset + interpolate(50, 100, 0, size, 0), 
             hOffset + bar_index + 3 * (pSize + 1), offset + interpolate(50, 100, 0, size, 0),
             color.new(#787b86, 50), bgcolor = #787b86 ))

        tiPanel.tiValues.push(box.new(
             hOffset + bar_index - 1 , offset + interpolate(25, 100, 0, size, 0), 
             hOffset + bar_index + 3 * (pSize + 1), offset + interpolate(25, 100, 0, size, 0),
             color.new(bearColor, 50), bgcolor = bearColor ))

        tiPanel.tiValues.push(box.new(
             hOffset + bar_index                      , offset + size + .50, 
             hOffset + bar_index + 3 * (pSize + 1) - 1, offset + size + .25,
             color.new(#787b86, 73), bgcolor = color.new(#787b86, 83) ))

        tiPanel.tiValues.push(box.new(
             hOffset + bar_index, offset + size + .50, 
             hOffset + bar_index + math.round((3 * (pSize + 1) - 1) * sentiment / 100), offset + size + .25,
             color.new(chart.fg_color, 73), bgcolor = color.from_gradient(sentiment, 0, 100, bearColor, bullColor) ))

        tiPanel.tiValues.push(box.new(
             hOffset + bar_index + 3 + 3 * (oscIndies.size()) - 2, offset + size * .85, 
             hOffset + bar_index + 3 + 3 * (oscIndies.size()) - 2, offset + size * -.2,
             color.new(#787b86, 75), bgcolor = color(na) ))

        for [index, element] in oscIndies

            tiPanel.tiValues.push(box.new(
                 hOffset + bar_index + 3 * index    , offset + interpolate(size * .5, 1, 0, 1, 0), // size * .5
                 hOffset + bar_index + 3 * index + 2, offset + interpolate(size * element, 100, 0, 1, 0),// size * (element - 0) / 100, 
                 color(na), bgcolor = color.from_gradient(element, 0, 100, bearColor, bullColor) ))

            tiPanel.tiTitles.push(label.new(
                 hOffset + bar_index + 3 * index + 1, offset, oscNames.get(index), color = color(na), size = size.tiny, style = label.style_label_up, 
                 textcolor = chart.fg_color, tooltip = oscTitles.get(index) + '\n Calculated Score: ' + str.tostring(element, '#.##') ))


        for [index, element] in trendIndies

            tiPanel.tiValues.push(box.new(
                 hOffset + bar_index + 3 + 3 * (oscIndies.size() + index)    , offset + size * .5, 
                 hOffset + bar_index + 3 + 3 * (oscIndies.size() + index) + 2, offset + size * (element - 0) / 100,
                 color(na), bgcolor = color.from_gradient(element, 0, 100, bearColor, bullColor) ))

            tiPanel.tiTitles.push(label.new(
                 hOffset + bar_index + 3 + 3 * (oscIndies.size() + index) + 1, offset, trendNames.get(index), color = color(na), size = size.tiny, style = label.style_label_up, 
                 textcolor = chart.fg_color, tooltip = trendTitles.get(index) + '\n Calculated Score: ' + str.tostring(element, '#.##') ))

scoreLeft(value) =>
    switch
        value >= 48.5 => 13
        value >= 45.3 => 12
        value >= 45 => 11
        value >= 42 => 10
        value >= 38.63 =>  9
        value >= 35.2 =>  8
        value >= 33.3 =>  7
        value >= 31.5 =>  6
        value >= 27.5 =>  5
        value >= 23.1 =>  4
        value >= 20 =>  3
        value >= 15.5 =>  2
        value >=  0 =>  1

scoreRight(value) =>
    switch
        value < 51.6 => 0
        value < 54.75 => 1
        value < 55.5 => 2
        value < 58.1 => 3
        value < 61.39 => 4
        value < 64.8 => 5
        value < 66.5 => 6
        value < 68.6 => 7
        value < 72.53 => 8
        value < 76.3 => 9
        value < 78.8 => 10
        value < 82.5 => 11
        value < 90 => 12
        value <= 100 => 13

processMeter(show, sentiment) =>
    if show
        radius = 13
        coefficient = .15
        base = 1.1
        index = bar_index 
        degrees = -(sentiment - 100) * 9 / 5
        
        polylines = polyline.all
        if polylines.size() > 0
            for i = 0 to polylines.size() - 1
                polyline.delete(polylines.shift())

        if meterLines.size() > 0
            for i = 0 to meterLines.size() - 1
                line.delete(meterLines.shift())

        if meterLabels.size() > 0
            for i = 0 to meterLabels.size() - 1
                label.delete(meterLabels.shift())

        //log.info("yaz_kizim {0} {1}", sentiment, degrees)

        for segment = radius to 0
            circulus.push(chart.point.from_index(index - segment +  hOffset + 17, base + coefficient * math.sqrt(math.pow(radius, 2) - math.pow(segment, 2)) ))

            if sentiment >= 50 or radius - segment <= scoreLeft(sentiment)
                meterLines.push(line.new(
                     index - segment + hOffset + 17, base + coefficient * math.sqrt(math.pow(radius, 2) - math.pow(segment    , 2)), 
                     index - segment + hOffset + 16, base + coefficient * math.sqrt(math.pow(radius, 2) - math.pow(segment + 1, 2)), 
                     xloc.bar_index, extend.none, color.from_gradient(radius - segment, 0, 26, bearColor, bullColor), line.style_solid, 5))

        for segment = radius to 0
            circulus.push(chart.point.from_index(index + radius - segment + hOffset + 17, 
                                             base + coefficient * math.sqrt(math.pow(radius, 2) - math.pow(radius - segment, 2)) ))

            if sentiment > 50 and radius - segment < scoreRight(sentiment) 
                meterLines.push(line.new(
                     index - segment + radius + hOffset + 17, base + coefficient * math.sqrt(math.pow(radius, 2) - math.pow(radius - segment    , 2)), 
                     index - segment + radius + hOffset + 18, base + coefficient * math.sqrt(math.pow(radius, 2) - math.pow(radius - segment + 1, 2)), 
                     xloc.bar_index, extend.none, color.from_gradient(2 * radius - segment - 1, 0, 26, bearColor, bullColor), line.style_solid, 5))

        polyline.new(circulus, false, false, line_color =  color.new(chart.fg_color, 73), line_width = 5)

        meterLines.push(line.new(
             index + hOffset + 17, base + coefficient,  
             index + hOffset + 17 + math.round((radius - 3) * math.cos(math.toradians(degrees))), base + coefficient * ((radius - 3) * math.sin(math.toradians(degrees))), 
             xloc.bar_index, extend.none, color.new(chart.fg_color, 50), line.style_solid, 3))

        meterLines.push(line.new(
             index + hOffset + 17, base + coefficient,  
             index + hOffset + 17 + math.round((radius - 3) * math.cos(math.toradians(degrees))), base + coefficient * ((radius - 3) * math.sin(math.toradians(degrees))), 
             xloc.bar_index, extend.none, color.new(chart.fg_color, 15), line.style_arrow_right, 1))

        meterLabels.push(label.new(index + hOffset + 17, base + coefficient, '', 
             color = color.new(chart.fg_color, 15), style = label.style_circle, size = size.auto, tooltip = str.tostring(sentiment, '#.#')))

        meterLabels.push(label.new(index + hOffset + 17 + math.round(radius * math.cos(math.toradians(160))), 
             base + coefficient * (radius * math.sin(math.toradians(160))), 'Strong\nBearish', 
             color = color(na), style = label.style_label_right, textcolor = sentiment <= 20 ? bearColor : #787b86))

        meterLabels.push(label.new(index + hOffset + 17 + math.round(radius * math.cos(math.toradians(130))), 
             base + coefficient * (radius * math.sin(math.toradians(130))), 'Bearish', 
             color = color(na), style = label.style_label_lower_right, textcolor = sentiment > 20 and sentiment <= 40 ? bearColor : #787b86))

        meterLabels.push(label.new(index + hOffset + 17 + math.round(radius * math.cos(math.toradians( 90))), 
             base + coefficient * (radius * math.sin(math.toradians( 90))), 'Neutral', 
             color = color(na), style = label.style_label_down, textcolor = sentiment > 40 and sentiment <= 60 ? chart.fg_color : #787b86))

        meterLabels.push(label.new(index + hOffset + 17 + math.round(radius * math.cos(math.toradians( 50))), 
             base + coefficient * (radius * math.sin(math.toradians( 50))), 'Bullish', 
             color = color(na), style = label.style_label_lower_left, textcolor = sentiment > 60 and sentiment <= 80 ? bullColor : #787b86))

        meterLabels.push(label.new(index + hOffset + 17 + math.round(radius * math.cos(math.toradians( 20))), 
             base + coefficient * (radius * math.sin(math.toradians( 20))), 'Strong\nBullish', 
             color = color(na), style = label.style_label_left, textcolor = sentiment > 80 ? bullColor : #787b86))

//---------------------------------------------------------------------------------------------------------------------}
// Calculations
//---------------------------------------------------------------------------------------------------------------------{

[closeValue, rsiValue, stochValue, stochRSIValue, cciValue, bbpValue, maValue, vwapValue, bbValue, stValue, regValue, msValue] = 
     collectData(timeframe(indi_tf))

sentiment = math.avg(rsiValue, stochValue, stochRSIValue, cciValue, bbpValue, maValue, nz(vwapValue, 50), bbValue, stValue, regValue, msValue)

if barstate.islast
    processData(panel_Show, indi_tf, closeValue, rsiValue, stochValue, stochRSIValue, cciValue, bbpValue, maValue, nz(vwapValue, 50), bbValue, stValue, regValue, msValue, sentiment, 5.25 + panel_Height, panel_Height)

processMeter(mrktMtr_Show and barstate.islast, sentiment)

tiRank = plot(mrktOsc_Show ? mrktOsc_height * sentiment / 100 : na, 'Oscillator', color.from_gradient(mrktOsc_height * sentiment, 0, mrktOsc_height * 100, bearColor, bullColor), mrktOsc_lnWidth, display = display)

upperBand = plot(mrktOsc_Show ? mrktOsc_height * .75 : na, 'Overbought Level', color.new(#787b86, 63), display = display)
midLine   = plot(mrktOsc_Show ? mrktOsc_height *  .5 : na, 'Equilibrium Level', color.new(#787b86, 63), display = display)
lowerBand = plot(mrktOsc_Show ? mrktOsc_height * .25 : na, 'Oversold Level', color.new(#787b86, 63), display = display)

fill(tiRank, midLine, mrktOsc_height *  1, mrktOsc_height * .5, top_color = color.new(bullColor,   0), bottom_color = color.new(bullColor, 100), title = "Bullish Gradient Fill")
fill(tiRank, midLine, mrktOsc_height * .5, mrktOsc_height *  0, top_color = color.new(bearColor, 100), bottom_color = color.new(bearColor,   0), title = "Bearish Gradient Fill")

//---------------------------------------------------------------------------------------------------------------------}
// Calculations - Divergence Indicator (Build-in TradingView Script)
//---------------------------------------------------------------------------------------------------------------------{

[isRegular, isHidden] = switch mrktOsc_Divergence
    'All' => [true, true]
    'Regular' => [true, false]
    'Hidden' => [false, true]
    => [false, false]

osc = mrktOsc_height * sentiment / 100
lbR = 5
lbL = 5
rUpper = 60
rLower = 5

plFound = na(ta.pivotlow(osc, lbL, lbR)) ? false : true
phFound = na(ta.pivothigh(osc, lbL, lbR)) ? false : true

_inRange(cond) =>
    bars = ta.barssince(cond == true)
    rLower <= bars and bars <= rUpper

oscHL = osc[lbR] > ta.valuewhen(plFound, osc[lbR], 1) and _inRange(plFound[1])
priceLL = low[lbR] < ta.valuewhen(plFound, low[lbR], 1)

bullCond = mrktOsc_Show and isRegular and priceLL and oscHL and plFound

plot(plFound ? osc[lbR] : na, 'Regular Bullish', bullCond ? bullColor : color(na), 2, offset = -lbR, display = display)
plotshape(bullCond ? osc[lbR] : na, 'Regular Bullish Label', shape.labelup, location.absolute, color.new(bullColor, 0), -lbR, display = display)

oscLL = osc[lbR] < ta.valuewhen(plFound, osc[lbR], 1) and _inRange(plFound[1])
priceHL = low[lbR] > ta.valuewhen(plFound, low[lbR], 1)

hiddenBullCond = mrktOsc_Show and isHidden and priceHL and oscLL and plFound

plot(plFound ? osc[lbR] : na, 'Hidden Bullish', hiddenBullCond ? color.new(bullColor, 73) : color(na), 2, offset = -lbR, display = display)
plotshape(hiddenBullCond ? osc[lbR] : na, 'Hidden Bullish Label', shape.labelup, location.absolute, color.new(bullColor, 73), -lbR, display = display)

oscLH = osc[lbR] < ta.valuewhen(phFound, osc[lbR], 1) and _inRange(phFound[1])
priceHH = high[lbR] > ta.valuewhen(phFound, high[lbR], 1)

bearCond = mrktOsc_Show and isRegular and priceHH and oscLH and phFound

plot(phFound ? osc[lbR] : na, 'Regular Bearish', bearCond ? bearColor : color(na), 2, offset = -lbR, display = display)
plotshape(bearCond ? osc[lbR] : na, 'Regular Bearish Label', shape.labeldown, location.absolute, color.new(bearColor, 0), -lbR, display = display)

oscHH = osc[lbR] > ta.valuewhen(phFound, osc[lbR], 1) and _inRange(phFound[1])
priceLH = high[lbR] < ta.valuewhen(phFound, high[lbR], 1)

hiddenBearCond = mrktOsc_Show and isHidden and priceLH and oscHH and phFound

plot(phFound ? osc[lbR] : na, 'Hidden Bearish', hiddenBearCond ? color.new(bearColor, 73) : color(na), 2, offset = -lbR, display = display)
plotshape(hiddenBearCond ? osc[lbR] : na, 'Hidden Bearish Label', shape.labeldown, location.absolute, color.new(bearColor, 73), -lbR, display = display)

//Plot to fix market sentiment location
plot(5.25 + panel_Height + panel_Height + .5, color = na, editable = false)

//---------------------------------------------------------------------------------------------------------------------}