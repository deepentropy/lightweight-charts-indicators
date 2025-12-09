// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=6
indicator('Statistical Trailing Stop [LuxAlgo]','LuxAlgo - Statistical Trailing Stop', overlay = true, max_labels_count = 500)
//---------------------------------------------------------------------------------------------------------------------}
//CONSTANTS & STRINGS & INPUTS
//---------------------------------------------------------------------------------------------------------------------{
GREEN                       = #089981
RED                         = #F23645
bearishColor                = color.new(RED,50)
bullishColor                = color.new(GREEN,50)

BULLISH                     = 1
BEARISH                     = 0

LEVEL0                      = 'Level 0'
LEVEL1                      = 'Level 1'
LEVEL2                      = 'Level 2'
LEVEL3                      = 'Level 3'

TOP_RIGHT                   = 'Top Right'
BOTTOM_RIGHT                = 'Bottom Right'
BOTTOM_LEFT                 = 'Bottom Left'

TINY                        = 'Tiny'
SMALL                       = 'Small'
NORMAL                      = 'Normal'
LARGE                       = 'Large'
HUGE                        = 'Huge'

DASHBOARD_GROUP             = 'DASHBOARD'
STYLE_GROUP                 = 'STYLE'

dataLengthInput             = input.int(    10,         'Data Length',          minval = 1)
normalizationLengthInput    = input.int(    100,        'Distribution Length',  minval = 10, maxval = 5000)
baseLevelInput              = input.string( LEVEL2,     'Base Level',           options=[LEVEL0,LEVEL1,LEVEL2,LEVEL3])

showStatisticsInput         = input.bool(   false,      'Show Statistics',  group = DASHBOARD_GROUP)
dashboardPositionInput      = input.string( TOP_RIGHT,  'Position',         group = DASHBOARD_GROUP, options = [TOP_RIGHT,BOTTOM_RIGHT,BOTTOM_LEFT])
dashboardSizeInput          = input.string( NORMAL,     'Size',             group = DASHBOARD_GROUP, options = [TINY,SMALL,NORMAL,LARGE,HUGE])

bearishColorInput           = input.color(  bearishColor,'',                group = STYLE_GROUP, inline='colors')
bullishColorInput           = input.color(  bullishColor,'',                group = STYLE_GROUP, inline='colors')

//---------------------------------------------------------------------------------------------------------------------}
//DATA STRUCTURES & VARIABLES
//---------------------------------------------------------------------------------------------------------------------{
type stats
    float pnl       = 0
    float profit    = 0
    float loss      = 0
    int trades      = 0
    int winners     = 0
    int losers      = 0
    int winnerBars  = 0
    int loserBars   = 0

type trail    
    int bias
    float delta     = na    
    float level     = na
    float extreme   = na
    float anchor    = na
    label tag       = na
    int index       = na

var stats longStats     = stats.new()
var stats shortStats    = stats.new()
var trail currentTrail  = trail.new(BEARISH)

var parsedDashboardPosition = switch dashboardPositionInput
    TOP_RIGHT       => position.top_right
    BOTTOM_RIGHT    => position.bottom_right
    BOTTOM_LEFT     => position.bottom_left

var parsedDashboardSize = switch dashboardSizeInput
    TINY            => size.tiny
    SMALL           => size.small
    NORMAL          => size.normal
    LARGE           => size.large
    HUGE            => size.huge

//---------------------------------------------------------------------------------------------------------------------}
//USER-DEFINED FUNCTIONS
//---------------------------------------------------------------------------------------------------------------------{
trueRange(int length) => math.max(ta.highest(length) - ta.lowest(length), math.abs(ta.highest(length) - close[length + 1]), math.abs(ta.lowest(length) - close[length + 1]))

getLevels() =>
    trueRange       = trueRange(10)
    avg             = ta.sma(math.log(trueRange),normalizationLengthInput)
    stdev           = ta.stdev(math.log(trueRange),normalizationLengthInput)
    sd0             = math.exp(avg + 0 * stdev)
    sd1             = math.exp(avg + 1 * stdev)
    sd2             = math.exp(avg + 2 * stdev)
    sd3             = math.exp(avg + 3 * stdev)

    parsedBaseLevel = switch baseLevelInput
        LEVEL0 => sd0
        LEVEL1 => sd1
        LEVEL2 => sd2
        LEVEL3 => sd3

    currentTrail.delta := parsedBaseLevel

updateTrail() =>
    if na(currentTrail.level) and not na(currentTrail.delta)
        currentTrail.level := currentTrail.bias == BEARISH ? hlc3 + currentTrail.delta : math.max(hlc3 - currentTrail.delta,0)

    currentTrail.extreme    := currentTrail.bias == BEARISH ? math.min(currentTrail.extreme,low) : math.max(currentTrail.extreme,high)
    currentTrail.level      := currentTrail.bias == BEARISH ? math.min(currentTrail.level,hlc3 + currentTrail.delta) : math.max(currentTrail.level,math.max(hlc3 - currentTrail.delta,0))

    priceDelta      = currentTrail.bias == BEARISH ? currentTrail.anchor - currentTrail.level : currentTrail.level - currentTrail.anchor
    lockedPercent   = currentTrail.bias == BEARISH ? priceDelta*100/(currentTrail.anchor - currentTrail.extreme) : priceDelta*100/(currentTrail.extreme - currentTrail.anchor)
    tagString       = str.tostring(priceDelta,format.mintick) + (priceDelta > 0 ? '\n' + str.tostring(lockedPercent,format.percent) : '')
    currentTrail.tag.set_text(tagString)
    
    trailTrigger = (currentTrail.bias == BEARISH and close >= currentTrail.level) or (currentTrail.bias == BULLISH and close <= currentTrail.level)
    
    if trailTrigger
        stats trailingStats     = currentTrail.bias == BEARISH ? shortStats : longStats        
        priceDeltaAtClose       = currentTrail.bias == BEARISH ? currentTrail.anchor - close : close - currentTrail.anchor        

        if not na(priceDeltaAtClose)
            trailingStats.trades    += 1
            trailingStats.pnl       += priceDeltaAtClose

            if priceDeltaAtClose > 0
                trailingStats.winners       += 1
                trailingStats.winnerBars    += bar_index - currentTrail.index
                trailingStats.profit        += priceDeltaAtClose
            else
                trailingStats.losers    += 1
                trailingStats.loserBars += bar_index - currentTrail.index
                trailingStats.loss      += priceDeltaAtClose                

        currentTrail.anchor     := close
        currentTrail.index      := bar_index
        currentTrail.bias       := currentTrail.bias == BEARISH ? BULLISH : BEARISH
        currentTrail.level      := currentTrail.bias == BEARISH ? hlc3 + currentTrail.delta : math.max(hlc3 - currentTrail.delta,0)
        currentTrail.extreme    := currentTrail.bias == BEARISH ? low : high
        currentTrail.tag        := label.new(chart.point.new(na,bar_index,currentTrail.level),'',color = color.new(chart.bg_color,100),textcolor = currentTrail.bias == BEARISH ? color.new(bearishColorInput,0) : color.new(bullishColorInput,0),style = currentTrail.bias == BEARISH ? label.style_label_down : label.style_label_up,size = size.small)
 
plotCell(table t_able, int col, int row, string data, color textColor = #FFFFFF) => t_able.cell(col,row,data,text_color = textColor,text_size = parsedDashboardSize)

plotHeaders(table t_able) =>
    plotCell(t_able,1,0,'LONGS')    
    plotCell(t_able,2,0,'SHORTS')
    plotCell(t_able,3,0,'TOTAL')

    plotCell(t_able,0,1,'PNL')
    plotCell(t_able,0,2,'GROSS PROFIT')
    plotCell(t_able,0,3,'GROSS LOSS')
    plotCell(t_able,0,4,'TRADES')
    plotCell(t_able,0,5,'WINNERS')
    plotCell(t_able,0,6,'LOSERS')
    plotCell(t_able,0,7,'AVG. WINNER')
    plotCell(t_able,0,8,'AVG. LOSER')
    plotCell(t_able,0,9,'WIN RATE')
    plotCell(t_able,0,10,'R/R')
    plotCell(t_able,0,11,'EXPECT.')
    plotCell(t_able,0,12,'AVG. BARS')
    plotCell(t_able,0,13,'AVG. WIN. BARS')
    plotCell(t_able,0,14,'AVG. LOS. BARS')

plotData(table t_able, stats s_tats, int col) =>
    pnl         = col == 3 ? longStats.pnl + shortStats.pnl : s_tats.pnl
    profit      = col == 3 ? longStats.profit + shortStats.profit : s_tats.profit
    loss        = col == 3 ? longStats.loss + shortStats.loss : s_tats.loss
    trades      = col == 3 ? longStats.trades + shortStats.trades : s_tats.trades
    winners     = col == 3 ? longStats.winners + shortStats.winners : s_tats.winners
    losers      = col == 3 ? longStats.losers + shortStats.losers : s_tats.losers
    avgWinner   = col == 3 ? (longStats.profit + shortStats.profit)/(longStats.winners + shortStats.winners) : s_tats.profit / s_tats.winners
    avgLoser    = col == 3 ? (longStats.loss + shortStats.loss)/(longStats.losers + shortStats.losers) : s_tats.loss / s_tats.losers
    winRate     = col == 3 ? (longStats.winners + shortStats.winners)/(longStats.trades + shortStats.trades) : s_tats.winners / s_tats.trades
    risk2reward = math.abs(avgWinner / avgLoser)
    expectacy   = (winRate * avgWinner) - (1 - winRate) * math.abs(avgLoser)
    winnerBars  = col == 3 ? longStats.winnerBars + shortStats.winnerBars : s_tats.winnerBars
    loserBars   = col == 3 ? longStats.loserBars + shortStats.loserBars : s_tats.loserBars
    bars        = math.round((winnerBars + loserBars)/trades)

    plotCell(t_able,col,1,str.tostring(pnl,format.mintick),color.new(chart.fg_color,25))
    plotCell(t_able,col,2,str.tostring(profit,format.mintick),color.new(chart.fg_color,25))
    plotCell(t_able,col,3,str.tostring(loss,format.mintick),color.new(chart.fg_color,25))
    plotCell(t_able,col,4,str.tostring(trades),color.new(chart.fg_color,25))
    plotCell(t_able,col,5,str.tostring(winners),color.new(chart.fg_color,25))
    plotCell(t_able,col,6,str.tostring(losers),color.new(chart.fg_color,25))
    plotCell(t_able,col,7,str.tostring(avgWinner,format.mintick),color.new(chart.fg_color,25))
    plotCell(t_able,col,8,str.tostring(avgLoser,format.mintick),color.new(chart.fg_color,25))
    plotCell(t_able,col,9,str.tostring(100*winRate,format.percent),color.new(chart.fg_color,25))
    plotCell(t_able,col,10,str.tostring(risk2reward,'0.00'),color.new(chart.fg_color,25))
    plotCell(t_able,col,11,str.tostring(expectacy,'0.00'),color.new(chart.fg_color,25))
    plotCell(t_able,col,12,str.tostring(bars),color.new(chart.fg_color,25))
    plotCell(t_able,col,13,str.tostring(math.round(winnerBars/winners)),color.new(chart.fg_color,25))
    plotCell(t_able,col,14,str.tostring(math.round(loserBars/losers)),color.new(chart.fg_color,25))

statsDashboard() =>
    var table t_able = table.new(parsedDashboardPosition,4,15
     , bgcolor      = #1e222d
     , border_color = #373a46
     , border_width = 1
     , frame_color  = #373a46
     , frame_width  = 1)

    plotHeaders(t_able)
    plotData(t_able,longStats,1)
    plotData(t_able,shortStats,2)
    plotData(t_able,na,3)

//---------------------------------------------------------------------------------------------------------------------}
//MUTABLE VARIABLES & EXECUTION
//---------------------------------------------------------------------------------------------------------------------{
getLevels()
updateTrail()

if barstate.islast and showStatisticsInput
    statsDashboard()

bearishPlot     = plot(currentTrail.bias == BEARISH ? currentTrail.level    : na,   'Bearish Trail',    color.new(bearishColorInput,0),  style = plot.style_linebr)
bullishPlot     = plot(currentTrail.bias == BULLISH ? currentTrail.level    : na,   'Bullish Trail',    color.new(bullishColorInput,0),  style = plot.style_linebr)
bearishAnchor   = plot(currentTrail.bias == BEARISH ? currentTrail.anchor   : na,   'Bearish Anchor',   chart.bg_color,     style = plot.style_linebr)
bullishAnchor   = plot(currentTrail.bias == BULLISH ? currentTrail.anchor   : na,   'Bullish Anchor',   chart.bg_color,     style = plot.style_linebr)

fill(bearishPlot,bearishAnchor,currentTrail.bias == BEARISH and currentTrail.level <= currentTrail.anchor ? bearishColorInput : color.new(chart.bg_color,100),'Bearish Profit')
fill(bullishPlot,bullishAnchor,currentTrail.bias == BULLISH and currentTrail.level >= currentTrail.anchor ? bullishColorInput : color.new(chart.bg_color,100),'Bullish Profit')

int bias = currentTrail.bias
bool newTrail = not na(bias[1]) ? bias[1] != bias : false
plotshape(newTrail ? currentTrail.level : na,'Trail Mark',shape.circle,location.absolute,currentTrail.bias == BEARISH ? color.new(bearishColorInput,0) : color.new(bullishColorInput,0),size = size.tiny)

//---------------------------------------------------------------------------------------------------------------------}