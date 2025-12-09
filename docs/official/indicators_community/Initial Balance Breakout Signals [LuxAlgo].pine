// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=6
indicator('Initial Balance Breakout Signals [LuxAlgo]','LuxAlgo - Initial Balance Breakout Signals', overlay = true, max_lines_count = 500, max_boxes_count = 500, max_labels_count = 500)
//---------------------------------------------------------------------------------------------------------------------}
//CONSTANTS & STRINGS & INPUTS
//---------------------------------------------------------------------------------------------------------------------{
GREEN                   = #089981
RED                     = #F23645
SILVER_50               = color.new(color.silver,50)

DOTTED                  = 'Dotted'
DASHED                  = 'Dashed'
SOLID                   = 'Solid'

FORECAST1               = 'IB Against Previous Open'
FORECAST2               = 'Filter By Current Day Of Week'

EM_SPACE                = ' '
EN_SPACE                = ' '
FOUR_PER_EM_SPACE       = ' '
SIX_PER_EM_SPACE        = ' '

initialBalanceSpacing   = SIX_PER_EM_SPACE+SIX_PER_EM_SPACE
extensionSpacing        = EM_SPACE+EN_SPACE+SIX_PER_EM_SPACE
forecastSpacing         = EM_SPACE+FOUR_PER_EM_SPACE+FOUR_PER_EM_SPACE

EXTENSION_GROUP         = 'EXTENSIONS'
FIBONACCI_GROUP         = 'FIBONACCI LEVELS'
FORECAST_GROUP          = 'FORECAST'
STYLE_GROUP             = 'STYLE'

forecastMethodTooltip   = 'Select the forecast method.\nIB Against Previous Open calculates the average difference between the IB high and low and the previous day\'s IB open price.\nFilter by Current Day of Week option calculates the average difference between the IB high and low and the IB open price for the same day of the week.'
forecastLengthTooltip   = 'The number of data points used to calculate the average.'
forecastMultTooltip     = 'This multiplier will be applied to the average. Bigger numbers will result in wider predicted ranges.'

initialBalanceSizeInput = input.int(    10,         'Display Last X IBs',                       inline = 'ibAll',   minval = 1)
displayAllInput         = input.bool(   true,       'Display All',                              inline = 'ibAll')
initialBalanceInput     = input.session('0830-0930','Initial Balance'+initialBalanceSpacing,    inline = 'ib0')
initialBalanceAutoInput = input.bool(   true,       'Auto',                                     inline = 'ib0')
breakoutsInput          = input.bool(   true,       'Breakouts',                                inline = 'break0')
breakoutsSessionInput   = input.session('0930-0830','',                                         inline = 'break0')
breakoutsAutoInput      = input.bool(   true,       'Auto',                                     inline = 'break0')

topExtensionInput       = input.bool(   true,       'Top Extension %'+extensionSpacing, group = EXTENSION_GROUP,    inline = 'top')
topMultiplierInput      = input.int(    50,         '',                                 group = EXTENSION_GROUP,    inline = 'top',     minval = 1, step = 5) / 100
bottomExtensionInput    = input.bool(   true,       'Bottom Extension %',               group = EXTENSION_GROUP,    inline = 'bottom')
bottomMultiplierInput   = input.int(    50,         '',                                 group = EXTENSION_GROUP,    inline = 'bottom',  minval = 1, step = 5) / 100

fibonacciInput          = input.bool(   true,       'Display Fibonnaci',                group = FIBONACCI_GROUP)
fiboReverseInput        = input.bool(   false,      'Reverse',                          group = FIBONACCI_GROUP)

fiboLevel5DisplayInput  = input.bool(   true,       '',     group = FIBONACCI_GROUP,    inline = 'fibo5')
fiboLevel5Input         = input.float(  0.786,      '',     group = FIBONACCI_GROUP,    inline = 'fibo5')
fiboLevel5ColorInput    = input.color(  SILVER_50,  '',     group = FIBONACCI_GROUP,    inline = 'fibo5')
fiboLevel5StyleInput    = input.string( DASHED,     '',     group = FIBONACCI_GROUP,    inline = 'fibo5',   options = [DOTTED,DASHED,SOLID])

fiboLevel4DisplayInput  = input.bool(   true,       '',     group = FIBONACCI_GROUP,    inline = 'fibo4')
fiboLevel4Input         = input.float(  0.618,      '',     group = FIBONACCI_GROUP,    inline = 'fibo4')
fiboLevel4ColorInput    = input.color(  SILVER_50,  '',     group = FIBONACCI_GROUP,    inline = 'fibo4')
fiboLevel4StyleInput    = input.string( DASHED,     '',     group = FIBONACCI_GROUP,    inline = 'fibo4',   options = [DOTTED,DASHED,SOLID])

fiboLevel3DisplayInput  = input.bool(   true,       '',     group = FIBONACCI_GROUP,    inline = 'fibo3')
fiboLevel3Input         = input.float(  0.500,      '',     group = FIBONACCI_GROUP,    inline = 'fibo3')
fiboLevel3ColorInput    = input.color(  SILVER_50,  '',     group = FIBONACCI_GROUP,    inline = 'fibo3')
fiboLevel3StyleInput    = input.string( DASHED,     '',     group = FIBONACCI_GROUP,    inline = 'fibo3',   options = [DOTTED,DASHED,SOLID])

fiboLevel2DisplayInput  = input.bool(   true,       '',     group = FIBONACCI_GROUP,    inline = 'fibo2')
fiboLevel2Input         = input.float(  0.382,      '',     group = FIBONACCI_GROUP,    inline = 'fibo2')
fiboLevel2ColorInput    = input.color(  SILVER_50,  '',     group = FIBONACCI_GROUP,    inline = 'fibo2')
fiboLevel2StyleInput    = input.string( DASHED,     '',     group = FIBONACCI_GROUP,    inline = 'fibo2',   options = [DOTTED,DASHED,SOLID])

fiboLevel1DisplayInput  = input.bool(   true,       '',     group = FIBONACCI_GROUP,    inline = 'fibo1')
fiboLevel1Input         = input.float(  0.236,      '',     group = FIBONACCI_GROUP,    inline = 'fibo1')
fiboLevel1ColorInput    = input.color(  SILVER_50,  '',     group = FIBONACCI_GROUP,    inline = 'fibo1')
fiboLevel1StyleInput    = input.string( DASHED,     '',     group = FIBONACCI_GROUP,    inline = 'fibo1',   options = [DOTTED,DASHED,SOLID])

fibosLabelsInput        = input.bool(   false,      'Display Labels'+FOUR_PER_EM_SPACE,                    group = FIBONACCI_GROUP,    inline = 'fiboLabels')
fibosLabelSizeInput     = input.int(    10,         '|'+FOUR_PER_EM_SPACE+' Text Size'+FOUR_PER_EM_SPACE,   group = FIBONACCI_GROUP,    inline = 'fiboLabels')

forecastInput           = input.bool(   true,       'Display Forecast'+forecastSpacing, group = FORECAST_GROUP,     inline = 'forecast')
forecastModeInput       = input.string( FORECAST1,  '',                                 group = FORECAST_GROUP,     tooltip = forecastMethodTooltip,    options = [FORECAST1,FORECAST2], inline = 'forecast')
forecastLengthInput     = input.int(    10,         'Forecast Memory',                  group = FORECAST_GROUP,     tooltip = forecastLengthTooltip,    minval = 2)
forecastMultiplierInput = input.float(  1.0,        'Forecast Multiplier',              group = FORECAST_GROUP,     tooltip = forecastMultTooltip,      minval = 0.1,   step = 0.25)

forecastTopColorInput   = input.color(  GREEN,      'Forecast Top Color',               group = FORECAST_GROUP)
forecastBottomColorInput= input.color(  RED,        'Forecast Bottom Color',            group = FORECAST_GROUP)
forecastStyleInput      = input.string( DOTTED,     'Forecast Style',                   group = FORECAST_GROUP,     options = [DOTTED,DASHED,SOLID])

ibTopColorInput         = input.color(  GREEN,      'IB Top Color',                     group = STYLE_GROUP)
ibBottomColorInput      = input.color(  RED,        'IB Bottom Color',                  group = STYLE_GROUP)
transparencyInput       = input.int(    80,         'Extension Transparency',           group = STYLE_GROUP,        minval = 0, maxval = 100)

//---------------------------------------------------------------------------------------------------------------------}
//DATA STRUCTURES & VARIABLES
//---------------------------------------------------------------------------------------------------------------------{
type initialBalance
    int startTime
    int endTime    
    int dayOfWeek
    float openPrice
    float top
    float bottom
    int endOfSession
    array<line> lines
    box background
    array<line> fibos
    array<label> labels
    array<line> forecast
    float forecastTop
    float forecastBottom

type forecastData
    float top
    float bottom

type forecastArray
    array<float> tops
    array<float> bottoms

var array<initialBalance> initialBalances       = array.new<initialBalance>()
var forecastData currentForecast                = forecastData.new(na,na)
var forecastArray simpleForecastArray           = forecastArray.new(array.new<float>(),array.new<float>())
var array<forecastArray> dayOfWeekForecastArray = array.from(forecastArray.new(array.new<float>(),array.new<float>()),forecastArray.new(array.new<float>(),array.new<float>()),forecastArray.new(array.new<float>(),array.new<float>()),
     forecastArray.new(array.new<float>(),array.new<float>()),forecastArray.new(array.new<float>(),array.new<float>()),forecastArray.new(array.new<float>(),array.new<float>()),forecastArray.new(array.new<float>(),array.new<float>()),
     forecastArray.new(array.new<float>(),array.new<float>()))

bool forecastFilter         = forecastModeInput == FORECAST2
var int autoIBStartTime     = time
autoIBStartTime             := session.isfirstbar_regular ? time : autoIBStartTime
int autoIBEndTime           = autoIBStartTime + 3600000
insideAutoInitialBalance    = time >= autoIBStartTime and time < autoIBEndTime
insideAutoBreakoutsSession  = time >= autoIBEndTime
insideInitialBalance        = initialBalanceAutoInput ? insideAutoInitialBalance : not na(time(timeframe.period, initialBalanceInput))
initialBalanceStart         = insideInitialBalance and not insideInitialBalance[1]
insideBreakoutsSession      = breakoutsAutoInput ? insideAutoBreakoutsSession : not na(time(timeframe.period, breakoutsSessionInput))

//---------------------------------------------------------------------------------------------------------------------}
//USER-DEFINED FUNCTIONS
//---------------------------------------------------------------------------------------------------------------------{
updateCurrentForecast() =>
    if initialBalances.size() > 0
        forecastArray f_orecastArray    = forecastFilter ? dayOfWeekForecastArray.get(dayofweek) : simpleForecastArray
        float openPrice                 = forecastFilter ? open : initialBalances.get(-1).openPrice
        currentForecast.top             := openPrice + forecastMultiplierInput * f_orecastArray.tops.avg()
        currentForecast.bottom          := openPrice + forecastMultiplierInput * f_orecastArray.bottoms.avg()    

addForecastData(float top, float bottom, float openPrice, int dayOfWeek) =>    
    forecastArray f_orecastArray = not na(dayOfWeek) ? dayOfWeekForecastArray.get(dayOfWeek) : simpleForecastArray    
    f_orecastArray.tops.push(top - openPrice)
    f_orecastArray.bottoms.push(bottom - openPrice)

    if f_orecastArray.tops.size() > forecastLengthInput
        f_orecastArray.tops.shift()
        f_orecastArray.bottoms.shift()

gatherForecastData() =>
    float top       = 0
    float bottom    = 0
    if initialBalances.size() >= 2
        initialBalance currentInitialBalance = initialBalances.get(-1)        
        if forecastFilter
            addForecastData(currentInitialBalance.top, currentInitialBalance.bottom, currentInitialBalance.openPrice, currentInitialBalance.dayOfWeek)            
        else
            initialBalance lastInitialBalance = initialBalances.get(-2)
            addForecastData(currentInitialBalance.top, currentInitialBalance.bottom, lastInitialBalance.openPrice, na)            

gatherData() =>
    if initialBalanceStart
        if forecastInput                    
            gatherForecastData()
            updateCurrentForecast()
        initialBalances.push(initialBalance.new(time,time,dayofweek,open,high,low,time,array.new<line>(),na,array.new<line>(),array.new<label>(),array.new<line>(),currentForecast.top,currentForecast.bottom))

    if initialBalances.size() > 0
        initialBalance currentInitialBalance= initialBalances.last()
        currentInitialBalance.endOfSession  := time
        
        if insideInitialBalance            
            currentInitialBalance.endTime   := time
            currentInitialBalance.top       := math.max(currentInitialBalance.top,high)
            currentInitialBalance.bottom    := math.min(currentInitialBalance.bottom,low)                    

breakouts() =>    
    bool bullishBreakout = false
    bool bearishBreakout = false
    
    if breakoutsInput and initialBalances.size() > 0 and insideBreakoutsSession
        initialBalance currentInitialBalance = initialBalances.last()
        bullishBreakout := close[1] < currentInitialBalance.top and close > currentInitialBalance.top
        bearishBreakout := close[1] > currentInitialBalance.bottom and close < currentInitialBalance.bottom

    [bullishBreakout,bearishBreakout]

style(string style) =>
    switch style
        DOTTED  => line.style_dotted
        DASHED  => line.style_dashed
        SOLID   => line.style_solid

drawFibonacciLevel(bool drawLevel, initialBalance currentInitialBalance, float fibonacciLevel, color fibonacciColor, string fibonacciStyle) =>
    if drawLevel
        float fibonacciRange    = math.round_to_mintick(fibonacciLevel * (currentInitialBalance.top - currentInitialBalance.bottom))
        float priceLevel        = fiboReverseInput ? currentInitialBalance.bottom + fibonacciRange : currentInitialBalance.top - fibonacciRange
        chart.point lastPoint   = chart.point.new(currentInitialBalance.endOfSession,na,priceLevel)
        currentInitialBalance.fibos.push(line.new(chart.point.new(currentInitialBalance.startTime,na,priceLevel),lastPoint,xloc.bar_time, color = fibonacciColor, style = fibonacciStyle, width = 1))
        
        if fibosLabelsInput
            currentInitialBalance.labels.push(label.new(lastPoint,str.format('{0} ({1})',fibonacciLevel,priceLevel),xloc = xloc.bar_time, yloc = yloc.price, color = color(na), textcolor = fibonacciColor, style = label.style_label_left, size = fibosLabelSizeInput))

drawFibonnaciLevels(initialBalance currentInitialBalance) =>

    for eachLine in currentInitialBalance.fibos
        eachLine.delete()

    for eachLabel in currentInitialBalance.labels
        eachLabel.delete()    

    drawFibonacciLevel(fiboLevel1DisplayInput,currentInitialBalance,fiboLevel1Input,fiboLevel1ColorInput,style(fiboLevel1StyleInput))
    drawFibonacciLevel(fiboLevel2DisplayInput,currentInitialBalance,fiboLevel2Input,fiboLevel2ColorInput,style(fiboLevel2StyleInput))
    drawFibonacciLevel(fiboLevel3DisplayInput,currentInitialBalance,fiboLevel3Input,fiboLevel3ColorInput,style(fiboLevel3StyleInput))
    drawFibonacciLevel(fiboLevel4DisplayInput,currentInitialBalance,fiboLevel4Input,fiboLevel4ColorInput,style(fiboLevel4StyleInput))   
    drawFibonacciLevel(fiboLevel5DisplayInput,currentInitialBalance,fiboLevel5Input,fiboLevel5ColorInput,style(fiboLevel5StyleInput))

drawInitialBalanceLevel(initialBalance currentInitialBalance,float level, bool extension, float multiplier, color c_olor) =>
    currentInitialBalance.lines.push(line.new(chart.point.new(currentInitialBalance.startTime,na,level),chart.point.new(currentInitialBalance.endOfSession,na,level),xloc.bar_time, color = c_olor, width = 1))            
    if extension
        float extensionLevel = math.round_to_mintick(level + multiplier * (currentInitialBalance.top - currentInitialBalance.bottom))
        currentInitialBalance.lines.push(line.new(chart.point.new(currentInitialBalance.startTime,na,extensionLevel),chart.point.new(currentInitialBalance.endOfSession,na,extensionLevel),xloc.bar_time, color = c_olor, width = 1))
        linefill.new(currentInitialBalance.lines.get(-1),currentInitialBalance.lines.get(-2), color.new(c_olor,transparencyInput))

drawForecast(initialBalance currentInitialBalance) =>
    for eachLine in currentInitialBalance.forecast
        eachLine.delete()
    currentInitialBalance.forecast.push(line.new(chart.point.new(currentInitialBalance.startTime,na,currentInitialBalance.forecastTop),chart.point.new(currentInitialBalance.endOfSession,na,currentInitialBalance.forecastTop),xloc.bar_time, color = forecastTopColorInput, width = 1, style = style(forecastStyleInput)))            
    currentInitialBalance.forecast.push(line.new(chart.point.new(currentInitialBalance.startTime,na,currentInitialBalance.forecastBottom),chart.point.new(currentInitialBalance.endOfSession,na,currentInitialBalance.forecastBottom),xloc.bar_time, color = forecastBottomColorInput, width = 1, style = style(forecastStyleInput)))            

drawInitialBalance(initialBalance currentInitialBalance) =>
    if forecastInput
        drawForecast(currentInitialBalance)

    if fibonacciInput
        drawFibonnaciLevels(currentInitialBalance)
                                    
    for eachLine in currentInitialBalance.lines
        eachLine.delete()

    drawInitialBalanceLevel(currentInitialBalance,currentInitialBalance.top,topExtensionInput,topMultiplierInput,ibTopColorInput)
    drawInitialBalanceLevel(currentInitialBalance,currentInitialBalance.bottom,bottomExtensionInput,-1*bottomMultiplierInput,ibBottomColorInput)            

    currentInitialBalance.background.delete()
    currentInitialBalance.background := box.new(chart.point.new(currentInitialBalance.startTime,na,currentInitialBalance.top),chart.point.new(currentInitialBalance.endTime,na,currentInitialBalance.bottom),border_color = color.new(color.silver,90),bgcolor = color.new(color.silver,90), xloc = xloc.bar_time)

drawInitialBalances(int initialBalanceNumber) =>
    size = initialBalances.size()
    if size > 0    
        int startIndex = size - (displayAllInput ? size : initialBalanceNumber)
        for currentInitialBalance in initialBalances.slice(startIndex,size)
            drawInitialBalance(currentInitialBalance)

//---------------------------------------------------------------------------------------------------------------------}
//MUTABLE VARIABLES & EXECUTION
//---------------------------------------------------------------------------------------------------------------------{
gatherData()

[bullishBreakout,bearishBreakout] = breakouts()
plotshape(bullishBreakout,  'Bullish Breakout', shape.triangleup,   location.belowbar,  ibTopColorInput,    size = size.tiny)
plotshape(bearishBreakout,  'Bearish Breakout', shape.triangledown, location.abovebar,  ibBottomColorInput, size = size.tiny)

if barstate.islastconfirmedhistory
    drawInitialBalances(initialBalanceSizeInput)

if barstate.islast
    drawInitialBalance(initialBalances.last())
   
//---------------------------------------------------------------------------------------------------------------------}