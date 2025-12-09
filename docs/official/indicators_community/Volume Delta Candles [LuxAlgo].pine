// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator(    'Volume Delta Candles [LuxAlgo]'
 , shorttitle='LuxAlgo - Volume Delta Candles'
 , max_labels_count=500
 , overlay=true
 ),n=bar_index

//------------------------------------------------------------------------------
// Settings
//-----------------------------------------------------------------------------{
tick   = input.string   ('LTF'     , 'Data from: ', options= [  'Ticks' ,   'LTF'   ] )
res    = input.timeframe( '1'                                                         , tooltip= "Data from: 'LTF'\nAuto: 'Disabled'"  )
auto   = input.bool     (   true   ,      ''      , inline='auto'                     )
mlt    = input.int      (   1500   ,  ' Auto   '  , inline='auto'                     , tooltip="current TF divided by x\n\nData from: 'LTF'\nAuto: 'Enabled'")
prem   = input.bool     (  false   ,  'Premium'   , tooltip=  'Premium Plan or higher')
colUp  = input.color    (#089981 ,  'Up     '   , inline='u', group='Intrabar Delta')
colUp_ = input.color    (#f23645 ,  'Up -     ' , inline='u', group='Intrabar Delta', tooltip= 'Up -\n-> bullish candle and - Delta' )
colDn  = input.color    (#f23645 ,  'Down'      , inline='d', group='Intrabar Delta')
colDn_ = input.color    (#089981 ,  'Down +'    , inline='d', group='Intrabar Delta', tooltip='Down +\n-> bearish candle and + Delta')
option = input.string   ('full bar',  'Display'   , options= ['half bar', 'full bar'] )
dot    = input.bool     (  false   ,                'Show Previous Max Volume Price'  )
showTab= input.bool     (   true   ,   'Show TF'              , group=     'Table'    )
tabCol = input.color  (#b2b5beaa , 'Text Color'             , group=     'Table'    )     
sizeT  = input.string   (size.tiny , 'Size Table'             , group=     'Table'
       , options =            [size.tiny, size.small, size.normal, size.large])
showD  = input.bool     (  false   ,'Show details',             group=    'Details'   ) 
INV    = color.new(na,na)
CFG    = chart.fg_color
isTick = tick =='Ticks'
isLTF  = tick =='LTF'

//-----------------------------------------------------------------------------}      
//UDT
//-----------------------------------------------------------------------------{
type bin 
    varip float p 
    varip float v

//-----------------------------------------------------------------------------}      
//Variables
//-----------------------------------------------------------------------------{
varip float volBl = na
varip float volBr = na
varip float volNt = na
varip bin   maxBl = bin.new(na, 0)
varip bin   maxBr = bin.new(na, 0)
varip float  vl   = na
varip float  cl   = na
varip float  dfP  = na
varip float  dfV  = na
varip float  TdfV = na
varip bool ticksAvailable = false

var table tab = na   

//-----------------------------------------------------------------------------}      
//Execution
//-----------------------------------------------------------------------------{
//Ticks
if isTick 
    if barstate.isnew 
        maxBl.v := 0, maxBr.v := 0
        cl     :=  open , dfP := 0             // "open" 
        vl     := volume, dfV := 0, TdfV  := 0 // "volume" at first tick
        volBl  :=  0  , volBr := 0, volNt := 0 // dfV
    else
        dfP   := close  - cl
        dfV   := volume - vl

        switch 
            dfP > 0 => 
                volBl += dfV, TdfV += dfV 
                if dfV > maxBl.v 
                    maxBl.v := dfV, maxBl.p := close

            dfP < 0 => 
                volBr += dfV, TdfV += dfV 
                if dfV > maxBr.v 
                    maxBr.v := dfV, maxBr.p := close

        cl    :=  close
        vl    := volume
  
//LTF
tfS  = timeframe.in_seconds(      res       )
tfC  = timeframe.in_seconds(timeframe.period)
rs   = auto ? tfC / mlt : tfS 
rs  := prem ? rs : math.max(60, rs)
res := timeframe.from_seconds(math.min(tfC, rs))

[bV, sV, nV, tV, aCl] = request.security_lower_tf(
  syminfo.tickerid,  res  , 
 [
   close >  open ? volume : 0
 , close <  open ? volume : 0
 , close == open ? volume : 0
 , volume
 , close
 ]                                          )

vSize = tV.size()

//Highest volume when price movement (neutral volume not included)
float maxV = na, float bVmax = na , float sVmax = na 

if isLTF
    bVmax      := bV.max()
    sVmax      := sV.max()
    indices     = (bVmax > sVmax ? bV : sV).sort_indices(order.descending)
    maxV       := indices.size() > 0 ? aCl.get(indices.first()) : na
else 
    if maxBl.v != 0 or maxBr.v != 0
        maxV   := maxBl.v > maxBr.v ? maxBl.p : maxBr.p

// start Tick data
if not ticksAvailable and volBl > 0 
    ticksAvailable := true 

isAllowed = isTick ? ticksAvailable : tV.size() > 0

if isAllowed and not isAllowed[1]
    line.new(n, close, n, close + syminfo.mintick, color=color.silver, style=line.style_dotted, extend=extend.both)

ltf_Vup = bV.sum() 
ltf_Vdn = sV.sum() 

bullV = isTick ? volBl : ltf_Vup
bearV = isTick ? volBr : ltf_Vdn

abs   = math.abs(open  - close)
min   = math.min(open  , close)
max   = math.max(open  , close)
avg   = math.avg(open  , close)
vol   =          bullV + bearV
delta =          bullV - bearV

norm  = delta / volume
aNorm = math.abs(norm) 

pos   = norm >= 0 

float base  = na
float value = na
value := option == 'half bar' ? avg + norm*abs/2 :  pos ? min + aNorm*abs : max - aNorm*abs
base  := option == 'half bar' ? avg              :  pos ? min             : max

css   = close > open ? colUp : close < open ? colDn : CFG
cssD  = color.new(norm > 0   ? close > open ? colUp : colDn_ : close < open ? colDn : colUp_, 50)

//-----------------------------------------------------------------------------}      
//Plot
//-----------------------------------------------------------------------------{
barcolor(INV) // use 'Bar's style' "Bars" 
plotcandle(base, base, value, value, color = cssD, wickcolor = na , bordercolor =    na   , display = display.all - display.status_line)
plotcandle(open, high, low  , close, color =  na , wickcolor = css, bordercolor =    css  , display = display.all - display.status_line)
plotcandle(maxV, maxV, maxV , maxV , color = CFG , wickcolor = na , bordercolor =    CFG  , display = display.all - display.status_line)
plot      (dot ? maxV       : na   , color = CFG , style=plot.style_circles     , offset=1, display = display.all - display.status_line)
plot      (bullV                   ,                                                        display =               display.data_window)
plot      (bearV                   ,                                                        display =               display.data_window)

//-----------------------------------------------------------------------------}      
//Details
//-----------------------------------------------------------------------------{
volu = str.tostring(vol        , format.volume )
delt = str.tostring(delta      , format.volume )
perc = str.tostring(norm  * 100, format.percent)

if isAllowed and showD
    label.new(
       n
     , high
     , color=INV
     , textcolor=CFG
     , size=size.small
     , text=str.format(
     "Volume: {0}\nDelta: {1}\n%: {2}"
     , volu , delt, perc)
     )

//-----------------------------------------------------------------------------}      
//Table
//-----------------------------------------------------------------------------{
if showTab and isLTF
    if barstate.isfirst 
        tab  := table.new(position.top_right, 1, 1
             , bgcolor=INV
             )
    if barstate.islast
        tab.cell(0, 0, res, text_color=tabCol)

//-----------------------------------------------------------------------------} 