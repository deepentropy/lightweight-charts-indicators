// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Targets For Many Indicators [LuxAlgo]", shorttitle = "LuxAlgo - Targets For Many Indicators", overlay = true, max_lines_count = 500, max_labels_count = 500)

//-----------------------------------------------------------------------------}
//Target 1
//-----------------------------------------------------------------------------{
showLabels = input(true, 'Show Target Labels', inline = 'style')
candleColoring = input(true, 'Candle Coloring', inline = 'style')

//Condition Rule
enableTarget1 = input(true, 'Enable Target'
  , inline    = 'enable'
  , group     = 'Target 1')

isLong1       = input(true, 'Long Position Target'
  , inline    = 'enable'
  , group     = 'Target 1')

_ = input.string('Source A', 'New Target Condition', options = ['Source A']
  , inline    = 'targetRule1'
  , group     = 'Target 1')

target1Condition = input.string('CrossOver', ''
  , options   = ['CrossOver', 'CrossUnder', 'Cross', 'Equal']
  , inline    = 'targetRule1'
  , group     = 'Target 1')

_ = input.string('Source B', '', options = ['Source B']
  , inline    = 'targetRule1'
  , group     = 'Target 1')  

//Source A
targetSource1A = input.string('External', 'Source A'
  , options   = ['External', 'ACCDIST', 'ATR', 'BB Middle', 'BB Upper', 'BB Lower', 'CCI', 'CMO', 'COG', 'DC High', 'DC Mid', 'DC Low'
              , 'DEMA', 'EMA', 'HMA', 'III', 'KC Middle', 'KC Upper', 'KC Lower', 'LINREG', 'MACD', 'MACD-signal', 'MACD-histogram', 'MEDIAN'
              , 'MFI', 'MODE', 'MOM', 'NVI', 'OBV', 'PVI', 'PVT', 'RMA', 'ROC', 'RSI', 'SMA', 'STOCH', 'Supertrend'
              , 'TEMA', 'VWAP', 'VWMA', 'WAD', 'WMA', 'WVAD', '%R']
  , inline    = 'A'
  , group     = 'Target 1')

targetExternal1A = input(close, 'External'
  , inline    = 'A'
  , group     = 'Target 1')

targetTiSettings1A = input.string('', 'Settings'
  , inline    = 'A'
  , group     = 'Target 1')

//Source B
targetSource1B = input.string('Supertrend', 'Source B'
  , options   = ['External', 'Value', 'ACCDIST', 'ATR', 'BB Middle', 'BB Upper', 'BB Lower', 'CCI', 'CMO', 'COG', 'DC High', 'DC Mid', 'DC Low'
              , 'DEMA', 'EMA', 'HMA', 'III', 'KC Middle', 'KC Upper', 'KC Lower', 'LINREG', 'MACD', 'MACD-signal', 'MACD-histogram', 'MEDIAN'
              , 'MFI', 'MODE', 'MOM', 'NVI', 'OBV', 'PVI', 'PVT', 'RMA', 'ROC', 'RSI', 'SMA', 'STOCH', 'Supertrend'
              , 'TEMA', 'VWAP', 'VWMA', 'WAD', 'WMA', 'WVAD', '%R']
  , inline    = 'B'
  , group     = 'Target 1')

targetExternal1B = input(open, 'External'
  , inline    = 'B'
  , group     = 'Target 1')

targetTiSettings1B = input.string('10,3', 'Settings'
  , inline    = 'B'
  , group     = 'Target 1')

targetValue1B = input(0, 'Source B Value'
  , inline    = 'B_'
  , group     = 'Target 1')

target1Css    = input(#089981, 'Target Color '
  , inline    = 'style'
  , group     = 'Target 1')

target1Style  = input.string('- - -', '    Levels Style'
  , options   = ['──','- - -','· · ·']
  , inline    = 'style'
  , group     = 'Target 1')

showSource1   = input.bool(false, 'Show Source Values'
  , group     = 'Target 1')

//-----------------------------------------------------------------------------}
//Target 1 Logic
//-----------------------------------------------------------------------------{
waitTarget1   = input(false, 'Wait Until Reached'
  , group     = 'Target 1 Logic')

newTarget1    = input(false, 'New Target When Reached'
  , group     = 'Target 1 Logic')

useWicks1     = input(true, 'Evaluate Wicks'
  , group     = 'Target 1 Logic')

distTarget1   = input.float(3, 'Target Distance From Price'
  , inline    = 'dist1'
  , group     = 'Target 1 Logic')

distOptions1  = input.string('ATR', ''
  , options   = ['Currencies', '%', 'ATR', 'Ticks', 'External Value']
  , inline    = 'dist1'
  , group     = 'Target 1 Logic')

externalDist1 = input(close, 'External Distance Value'
  , group     = 'Target 1 Logic')

//-----------------------------------------------------------------------------}
//Target 2
//-----------------------------------------------------------------------------{
//Condition Rule
enableTarget2 = input(true, 'Enable Target'
  , inline    = 'enable'
  , group     = 'Target 2')

isLong2 = input(false, 'Long Position Target'
  , inline    = 'enable'
  , group     = 'Target 2')

_ = input.string('Source A', 'New Target Condition', options = ['Source A']
  , inline    = 'targetRule2'
  , group     = 'Target 2')

target2Condition = input.string('CrossUnder', ''
  , options   = ['CrossOver', 'CrossUnder', 'Cross', 'Equal']
  , inline    = 'targetRule2'
  , group     = 'Target 2')

_ = input.string('Source B', '', options = ['Source B']
  , inline    = 'targetRule2'
  , group     = 'Target 2')

//Source A
targetSource2A = input.string('External', 'Source A'
  , options   = ['External', 'ACCDIST', 'ATR', 'BB Middle', 'BB Upper', 'BB Lower', 'CCI', 'CMO', 'COG', 'DC High', 'DC Mid', 'DC Low'
              , 'DEMA', 'EMA', 'HMA', 'III', 'KC Middle', 'KC Upper', 'KC Lower', 'LINREG', 'MACD', 'MACD-signal', 'MACD-histogram', 'MEDIAN'
              , 'MFI', 'MODE', 'MOM', 'NVI', 'OBV', 'PVI', 'PVT', 'RMA', 'ROC', 'RSI', 'SMA', 'STOCH', 'Supertrend'
              , 'TEMA', 'VWAP', 'VWMA', 'WAD', 'WMA', 'WVAD', '%R']
  , inline    = 'A'
  , group     = 'Target 2')

targetExternal2A = input(close, 'External'
  , inline    = 'A'
  , group     = 'Target 2')

targetTiSettings2A = input.string('', 'Settings'
  , inline    = 'A'
  , group     = 'Target 2')

//Source B
targetSource2B = input.string('Supertrend', 'Source B'
  , options   = ['External', 'Value', 'ACCDIST', 'ATR', 'BB Middle', 'BB Upper', 'BB Lower', 'CCI', 'CMO', 'COG', 'DC High', 'DC Mid', 'DC Low'
              , 'DEMA', 'EMA', 'HMA', 'III', 'KC Middle', 'KC Upper', 'KC Lower', 'LINREG', 'MACD', 'MACD-signal', 'MACD-histogram', 'MEDIAN'
              , 'MFI', 'MODE', 'MOM', 'NVI', 'OBV', 'PVI', 'PVT', 'RMA', 'ROC', 'RSI', 'SMA', 'STOCH', 'Supertrend'
              , 'TEMA', 'VWAP', 'VWMA', 'WAD', 'WMA', 'WVAD', '%R']
  , inline    = 'B'
  , group     = 'Target 2')

targetExternal2B = input(open, 'External'
  , inline    = 'B'
  , group     = 'Target 2')

targetTiSettings2B = input.string('10,3', 'Settings'
  , inline    = 'B'
  , group     = 'Target 2')

targetValue2B = input(0, 'Source B Value'  
  , inline    = 'B_'
  , group     = 'Target 2')

target2Css    = input(#f23645, 'Target Color '
  , inline    = 'style'
  , group     = 'Target 2')

target2Style  = input.string('- - -', '    Levels Style'
  , options   = ['──','- - -','· · ·']
  , inline    = 'style'
  , group     = 'Target 2')

showSource2   = input.bool(false, 'Show Source Values'
  , group     = 'Target 2')

//-----------------------------------------------------------------------------}
//Target 2 Logic
//-----------------------------------------------------------------------------{
waitTarget2   = input(false, 'Wait Until Reached'
  , group     = 'Target 2 Logic')

newTarget2    = input(false, 'New Target When Reached'
  , group     = 'Target 2 Logic')

useWicks2     = input(true, 'Evaluate Wicks'
  , group     = 'Target 2 Logic')

distTarget2   = input.float(3, 'Target Distance From Price'
  , inline    = 'dist1'
  , group     = 'Target 2 Logic')

distOptions2  = input.string('ATR', ''
  , options   = ['Currencies', '%', 'ATR', 'Ticks', 'External Value']
  , inline    = 'dist1'
  , group     = 'Target 2 Logic')

externalDist2 = input(close, 'External Distance Value   '
  , group     = 'Target 2 Logic')

//-----------------------------------------------------------------------------}
//Target 2 Logic
//-----------------------------------------------------------------------------{
showDash      = input.bool     (    true      , 'Show Dashboard'                                                     , group= 'Dashboard')
dashLoc       = input.string   (  'Top Right' , 'Location'  , options = ['Top Right', 'Bottom Right', 'Bottom Left'] , group= 'Dashboard')
textSize      = input.string   (   'Normal'   , 'Size'      , options =          ['Tiny', 'Small', 'Normal']         , group= 'Dashboard')

//-----------------------------------------------------------------------------}
//UDT
//-----------------------------------------------------------------------------{
type lshape
    line v
    line h

type target
    float  value
    int    loc
    bool   reached
    bool   islong
    bool   active
    lshape lines
    label  lbl

//-----------------------------------------------------------------------------}
//Functions
//-----------------------------------------------------------------------------{
n = bar_index

INV = color.new(color.blue, 100)

aNoVisuals = array.from('ACCDIST', 'ATR', 'CCI', 'CMO', 'COG', 'III', 'MACD', 'MACD-signal', 'MACD-histogram', 'MFI', 'MOM', 'NVI', 'OBV', 'PVI', 'PVT', 'ROC', 'RSI', 'STOCH', 'WAD', 'WVAD', '%R')

a_1Val       = array.from( 'ATR'  ,  'CCI'  ,  'CMO'  ,  'COG'  , 'DC High', 'DC Mid', 'DC Low', 'DEMA'  ,  'EMA'  ,  'HMA'  , 'MEDIAN',  'MFI'  ,  'MODE' ,  'MOM'  ,  'RMA'  ,  'ROC'  ,  'RSI'  ,  'SMA'  , 'STOCH' , 'TEMA'  , 'VWMA'  ,  'WMA'  ,   '%R'  )
a_1ValValues = array.from('Length', 'Length', 'Length', 'Length', 'Length' , 'Length', 'Length', 'Length', 'Length', 'Length', 'Length', 'Length', 'Length', 'Length', 'Length', 'Length', 'Length', 'Length', 'Length', 'Length', 'Length', 'Length', 'Length')

a_2Val       = array.from( 'BB Middle'     ,   'BB Upper'     ,   'BB Lower'     ,  'KC Middle'     ,   'KC Upper'     ,   'KC Lower'     ,    'LINREG'      ,     'Supertrend'    )
a_2ValValues = array.from('Length, Mult'   , 'Length, Mult'   , 'Length, Mult'   , 'Length, Mult'   , 'Length, Mult'   , 'Length, Mult'   , 'Length, Offset' , 'ATR Length, Factor')

a_3Val       = array.from(              'MACD'             ,           'MACD-signal'          ,         'MACD-histogram'         )
a_3ValValues = array.from('Short, Long & Signal EMA Length', 'Short, Long & Signal EMA Length', 'Short, Long & Signal EMA Length')

method set_target(target id, css, lstyle)=>
    style = switch lstyle
        '- - -' => line.style_dashed
        '· · ·' => line.style_dotted
        =>         line.style_solid
    
    id.lines := lshape.new(line.new(n, close, n, id.value, color = css, style = style),
      line.new(n, id.value, n, id.value, color = css, style = style))

method delete(target id)=>
    id.lines.v.delete()
    id.lines.h.delete()

method getSetting(array<string> id , idx) => int(str.tonumber(id.get(idx)))

method getStFloat(array<string> id , idx) =>     str.tonumber(id.get(idx))

method isString  (array<string> settings) =>
    isS = false 
    for s in settings 
        if na(str.tonumber(s) / 1)
            isS := true 
            break 
    txt = isS ? 'Please, use numbers' : ''

method ema(int len, float source) => 
    alpha = 2 / (len + 1)
    float ema = na
    sma = ta.sma(source, len)
    ema := alpha * source + (1 - alpha) * nz(ema[1], sma[1])

method rma(int len, float source) =>
    alpha = 1 / len, float sum = 0
    sum := na(sum[1]) ? ta.sma(source, len) : alpha * source + (1 - alpha) * nz(sum[1])

method value(string choice, array<string> setting, float targetExternal, float targetValue) => 
  
    sZ  =  setting.size() , float value = na
    int int1 = na 

    if sZ > 0
        for  i  = setting.size ( ) -1 to 0
            get = setting.get  (i) 
            if  get == ''   or get == ' '
             or get == '  ' or get == '   '
                setting.remove (i)

    isS = setting.isString()
    txt = switch 
        isS != '' => isS
        a_1Val.includes(choice) =>
            if setting.size() != 1
                str.format    (   'Please enter 1 value for {0}: {1}'        , choice, a_1ValValues.get(a_1Val.indexof(choice)))
            else 
                if setting.getSetting(0) - setting.getStFloat(0) != 0
                    str.format('{0} ({1}) -> Length must be an Integer value', choice, a_1ValValues.get(a_1Val.indexof(choice)))
        
        a_2Val.includes(choice) =>
            if setting.size() != 2
                str.format    (   'Please enter 2 values for {0}: {1}'       , choice, a_2ValValues.get(a_2Val.indexof(choice)))
            else 
                if setting.getSetting(0) - setting.getStFloat(0) != 0
                    str.format('{0} ({1}) -> Length must be an Integer value', choice, a_2ValValues.get(a_2Val.indexof(choice)))

        a_3Val.includes(choice) =>
            if setting.size() != 3
                str.format    (   'Please enter 3 values for {0}: {1}'       , choice, a_3ValValues.get(a_3Val.indexof(choice)))
            else                
                if  setting.getSetting(0) - setting.getStFloat(0) != 0                
                 or setting.getSetting(1) - setting.getStFloat(1) != 0
                 or setting.getSetting(2) - setting.getStFloat(2) != 0
                    'Each Number must be an Integer value'

    float shortEMA = na, float longEMA = na, float macd    = na, float signal  = na, float hist = na
    float BBmiddle = na, float BBupper = na, float BBlower = na
    float KCmiddle = na, float KCupper = na, float KClower = na

    if txt == '' 
        if str.contains(choice, 'BB')
            len           = setting.getSetting(0)
            BBmiddle     := ta.sma(close, len)
            float dev     = setting.getStFloat(1) * ta.stdev(close, len)
            BBupper      := BBmiddle + dev 
            BBlower      := BBmiddle - dev

        if str.contains(choice, 'KC')
            KCmiddle     := setting.getSetting(0).ema(close)
            KCrange       = setting.getSetting(0).ema(ta.tr) 
            KCupper      := KCmiddle + KCrange * setting.getStFloat(1)
            KClower      := KCmiddle - KCrange * setting.getStFloat(1)

        if str.contains(choice, 'MACD')
            shortEMA     := setting.getSetting(0).ema(close) 
            longEMA      := setting.getSetting(1).ema(close) 
            macd         := shortEMA - longEMA
            signal       := setting.getSetting(2).ema(macd)
            hist         := macd - signal 

        value := switch choice 

            'ACCDIST'        => ta.accdist

            'ATR'            => setting.getSetting(0).rma(ta.tr(true))

            'BB Middle'      => BBmiddle 
            'BB Upper'       => BBupper
            'BB Lower'       => BBlower

            'CCI'            => ta.cci(close, setting.getSetting(0))

            'CMO'            => ta.cmo(close, setting.getSetting(0))

            'COG'            => ta.cog(close, setting.getSetting(0))

            'DC High'        =>                                             ta.highest(setting.getSetting(0))             
            'DC Mid'         => math.avg(ta.highest(setting.getSetting(0)), ta.lowest (setting.getSetting(0)))
            'DC Low'         =>                                             ta.lowest (setting.getSetting(0)) 

            'DEMA'           =>  
                len  = setting.getSetting(0)
                ema1 = len.ema(close)
                ema2 = len.ema(ema1 )
                2    * ema1 -  ema2       

            'EMA'            => setting.getSetting(0).ema(close)

            'External'       => targetExternal

            'HMA'            => 
                len = setting.getSetting(0)
                ta.wma(2 * ta.wma(close, math.floor(len / 2)) - ta.wma(close, len), math.floor(math.sqrt(len)))

            'III'            => ta.iii 

            'KC Middle'      => KCmiddle
            'KC Upper'       => KCupper
            'KC Lower'       => KClower

            'LINREG'         => 
                len = setting.getSetting(0), off = setting.getSetting(1)
                float sX     = 0, float sY = 0, float sXSqr = 0, float sXY = 0
                for i = 1   to len
                    val      = close[len-i], per = i+1, sX += per, sY += val
                    sXSqr   += math.pow(per, 2), sXY += val * per
                slope        = (sXY * len - sX * sY) / (sXSqr * len - math.pow(sX, 2))
                intcp        = ta.sma(close, len) - slope * sX / len + slope
                intcp + slope * (len - off)

            'MACD'           => macd 
            'MACD-signal'    => signal
            'MACD-histogram' => hist

            'MEDIAN'         => ta.median(close, setting.getSetting(0))

            'MFI'            => ta.mfi(close, setting.getSetting(0))  

            'MODE'           => ta.mode(close, setting.getSetting(0))

            'MOM'            => ta.mom(close, setting.getSetting(0))  

            'NVI'            => ta.nvi

            'OBV'            => ta.obv

            'PVI'            => ta.pvi

            'PVT'            => ta.pvt 

            'SMA'            => ta.sma(close, setting.getSetting(0))

            'RMA'            => setting.getSetting(0).rma(close)

            'ROC'            => ta.roc(close, setting.getSetting(0))

            'RSI'            => 
                len  = setting.getSetting(0), var num = 0., var den = 0., d = nz(close - close[1])
                num += (math.max(d, 0) - num) / len, den += (math.abs(d   ) - den) / len
                num / den * 100        

            'STOCH'          => ta.stoch(close, high, low, setting.getSetting(0))

            'Supertrend'     => 
                len          = setting.getSetting(0), factor    = setting.getStFloat(1)
                var atr      = 0. , var upper = high, var lower = low, var float trend = na
                atr         += (nz(ta.tr) - atr)  / len
                up           = hl2 + atr * factor   , dn = hl2 - atr * factor
                upper       := close[1] < upper ? math.min(up, upper) : up
                lower       := close[1] > lower ? math.max(dn, lower) : dn
                trend       := close    > upper ? 1 : close < lower ? 0 : trend
                trend       == 1 ? lower : upper

            'TEMA'           => 
                len  = setting.getSetting(0)
                ema1 = len.ema(close)
                ema2 = len.ema(ema1 )
                ema3 = len.ema(ema2 )
                (3 * ema1) - (3 * ema2) + ema3

            'Value'          => targetValue

            'VWAP'           => ta.vwap(close)

            'VWMA'           => ta.vwma(close, setting.getSetting(0))
            
            'WAD'            => ta.wad 

            'WMA'            => ta.wma(close, setting.getSetting(0))

            'WVAD'           => ta.wvad

            '%R'             => ta.wpr(setting.getSetting(0))

    [txt, value]

//-----------------------------------------------------------------------------}
//Set target 1
//-----------------------------------------------------------------------------{
var color css            = na
bool      isNewTarget1   = false
bool      isTgReached1   = false

var int countTargets1   = 0
var int countTgReached1 = 0

var target1_object      = target.new(reached = true, active = false)

var setting1A           = str.split(targetTiSettings1A, ',')
var setting1B           = str.split(targetTiSettings1B, ',')

[txt1A, source1A] = targetSource1A.value(setting1A, targetExternal1A,       na     )
[txt1B, source1B] = targetSource1B.value(setting1B, targetExternal1B, targetValue1B)

target1_condition = switch target1Condition
    'CrossOver'  => ta.crossover (source1A, source1B)
    'CrossUnder' => ta.crossunder(source1A, source1B)
    'Cross'      => ta.cross     (source1A, source1B)
    'Equal'      => source1A == source1B

//Distance
dist1 = switch distOptions1
    'Currencies' => distTarget1
    '%' => close + distTarget1 / 100 * close
    'ATR' => nz(ta.atr(50)) * distTarget1
    'Ticks' => syminfo.mintick * distTarget1
    'External Value' => externalDist1 * distTarget1

if target1_object.active and target1_object.reached == false
    target1_object.lines.h.set_x2(n)
    target1_object.lbl.set_x(n)

if (isLong1 ? (useWicks1 ? high : close) > target1_object.value : (useWicks1 ? low : close) < target1_object.value) and target1_object.active 
    target1_object.reached := true
    target1_object.active  := false 
    isTgReached1           := true
    countTgReached1        += 1
    css := na
    target1_object.lbl.set_color(target1Css)

if enableTarget1 and 
 (
  (target1_condition and (waitTarget1 ? target1_object.reached : true)) 
  or 
  (newTarget1 and target1_object.reached)
 ) 
    target_value = close + (isLong1 ? dist1 : -dist1)

    //Delete label if reached and creating new target
    if newTarget1 and target1_object.reached and showLabels
        target1_object.lbl.delete()

    //Create new target
    target1_object := target.new(target_value, n, false, isLong1, active = true)

    if showLabels
        target1_object.lbl := label.new(n, target_value, 'Target'
          , color = color.new(target1Css, 50)
          , textcolor = color.white
          , size = size.tiny
          , style = label.style_label_left
          , tooltip = str.tostring(target_value, format.mintick))

    css := target1Css

    target1_object.set_target(target1Css, target1Style)

    isNewTarget1  := true 
    countTargets1 += 1

//-----------------------------------------------------------------------------}
//Set target 2
//-----------------------------------------------------------------------------{
bool     isNewTarget2   = false
bool     isTgReached2   = false

var int countTargets2   = 0
var int countTgReached2 = 0

var target2_object      = target.new(reached = true, active = false)

var setting2A           = str.split(targetTiSettings2A, ',')
var setting2B           = str.split(targetTiSettings2B, ',')

[txt2A, source2A] = targetSource2A.value(setting2A, targetExternal2A,       na     )
[txt2B, source2B] = targetSource2B.value(setting2B, targetExternal2B, targetValue2B)

target2_condition = switch target2Condition
    'CrossOver'  => ta.crossover (source2A, source2B)
    'CrossUnder' => ta.crossunder(source2A, source2B)
    'Cross'      => ta.cross     (source2A, source2B)
    'Equal'      => source2A == source2B

//Distance
dist2 = switch distOptions2
    'Currencies' => distTarget2
    '%' => close + distTarget2 / 100 * close
    'ATR' => nz(ta.atr(50)) * distTarget2
    'Ticks' => syminfo.mintick * distTarget2
    'External Value' => externalDist2 * distTarget2

if target2_object.active and target2_object.reached == false
    target2_object.lines.h.set_x2(n)
    target2_object.lbl.set_x(n)

if (isLong2 ? (useWicks2 ? high : close) > target2_object.value : (useWicks2 ? low : close) < target2_object.value) and target2_object.active 
    target2_object.reached := true
    target2_object.active  := false 
    isTgReached2           := true
    countTgReached2        += 1
    css := na
    target2_object.lbl.set_color(target2Css)

if enableTarget2     and
 (
  (target2_condition and (waitTarget2 ? target2_object.reached : true)) 
  or 
  (newTarget2 and target2_object.reached)
 ) 
    target_value = close + (isLong2 ? dist2 : -dist2)

    //Delete label if reached and creating new target
    if newTarget2 and target2_object.reached and showLabels
        target2_object.lbl.delete()

    //Create new target
    target2_object := target.new(target_value, n, false, isLong2, active = true)

    if showLabels
        target2_object.lbl := label.new(n, target_value, 'Target'
          , color = color.new(target2Css, 50)
          , textcolor = color.white
          , size = size.tiny
          , style = label.style_label_left
          , tooltip = str.tostring(target_value, format.mintick))
    
    css := target2Css

    target2_object.set_target(target2Css, target2Style)

    isNewTarget2  := true 
    countTargets2 += 1

//-----------------------------------------------------------------------------}
//Plots
//-----------------------------------------------------------------------------{
noVisuals1 = array.includes(aNoVisuals, targetSource1A) or array.includes(aNoVisuals, targetSource1B) 
noVisuals2 = array.includes(aNoVisuals, targetSource2A) or array.includes(aNoVisuals, targetSource2B) 

plot(showSource1 and enableTarget1 and not noVisuals1 ? source1A : na, 'Target 1, source A', color=#089981)
plot(showSource1 and enableTarget1 and not noVisuals1 ? source1B : na, 'Target 1, source B', color=#2157f3)

plot(showSource2 and enableTarget2 and not noVisuals2 ? source2A : na, 'Target 2, source A', color=#ffe400)
plot(showSource2 and enableTarget2 and not noVisuals2 ? source2B : na, 'Target 2, source B', color=#ff1100)

barcolor(candleColoring ? css : na, title = 'Candle Coloring')

//-----------------------------------------------------------------------------}
//Dashboard
//-----------------------------------------------------------------------------{
var table_position = dashLoc == 'Bottom Left' ? position.bottom_left 
  : dashLoc == 'Top Right' ? position.top_right 
  : position.bottom_right

var table_size = textSize == 'Tiny' ? size.tiny 
  : textSize == 'Small' ? size.small 
  : size.normal

var tb = table.new(table_position, 3, 8 // 4 + countErrors
  , bgcolor      = #1e222d
  , border_color = #373a46
  , border_width = 1
  , frame_color  = #373a46
  , frame_width  = 1)

countErrors  = 0
countErrors += txt1A != '' ? 1 : 0
countErrors += txt1B != '' ? 1 : 0
countErrors += txt2A != '' ? 1 : 0
countErrors += txt2B != '' ? 1 : 0

if showDash

    if barstate.isfirst
        if enableTarget1 or enableTarget2
            tb.cell(0, 0,             ''           , text_color = color.white, text_size = table_size)
            tb.cell(1, 0,          'Count'         , text_color = color.white, text_size = table_size)
            tb.cell(2, 0,    'Target\nReached'     , text_color = color.white, text_size = table_size)
            tb.cell(0, 3,         'Total'          , text_color = color.white, text_size = table_size)

        if enableTarget1
            tb.cell(0, 1,        'Target 1'        , text_color = color.white, text_size = table_size)
        if enableTarget2
            tb.cell(0, 2,        'Target 2'        , text_color = color.white, text_size = table_size)
        
        if enableTarget1 and txt1A != '' 
            tb.merge_cells(0, 4, 2, 4)
            tb.cell(0, 4, str.format("Target 1, Source A: {0}\n", txt1A), text_color=#FF0000, text_halign=text.align_left)
        if enableTarget1 and txt1B != '' 
            tb.merge_cells(0, 5, 2, 5)
            tb.cell(0, 5, str.format("Target 1, Source B: {0}\n", txt1B), text_color=#FF0000, text_halign=text.align_left)
        if enableTarget2 and txt2A != '' 
            tb.merge_cells(0, 6, 2, 6)
            tb.cell(0, 6, str.format("Target 2, Source A: {0}\n", txt2A), text_color=#FF0000, text_halign=text.align_left)
        if enableTarget2 and txt2B != '' 
            tb.merge_cells(0, 7, 2, 7)
            tb.cell(0, 7, str.format("Target 2, Source B: {0}\n", txt2B), text_color=#FF0000, text_halign=text.align_left)

    if barstate.islast

        totT = countTargets1   + countTargets2        
        totR = countTgReached1 + countTgReached2
 
        if enableTarget1
            tb.cell(1, 1, str.tostring(countTargets1)                                                                       , text_color = color.white, text_size = table_size)
            tb.cell(2, 1, str.format  ('{0} ({1}%)', countTgReached1 , math.round(100 / countTargets1 * countTgReached1, 1)), text_color = color.white, text_size = table_size)
        if enableTarget2
            tb.cell(1, 2, str.tostring(countTargets2)                                                                       , text_color = color.white, text_size = table_size)
            tb.cell(2, 2, str.format  ('{0} ({1}%)', countTgReached2 , math.round(100 / countTargets2 * countTgReached2, 1)), text_color = color.white, text_size = table_size)
        if enableTarget1 or enableTarget2
            tb.cell(1, 3, str.tostring(     totT    )                                                                       , text_color = color.white, text_size = table_size)
            tb.cell(2, 3, str.format  ('{0} ({1}%)',       totR      , math.round(100 /      totT     *       totR     , 1)), text_color = color.white, text_size = table_size)

//-----------------------------------------------------------------------------}
//Alerts
//-----------------------------------------------------------------------------{
alertcondition(isNewTarget1, "Target 1 New"    , "Target 1 New"    )
alertcondition(isTgReached1, 'Target 1 Reached', 'Target 1 Reached')

alertcondition(isNewTarget2, "Target 2 New"    , "Target 2 New"    )
alertcondition(isTgReached2, 'Target 2 Reached', 'Target 2 Reached')

//-----------------------------------------------------------------------------}