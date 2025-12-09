// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator( 'Swing Failure Pattern [LuxAlgo]', 'LuxAlgo - Swing Failure Pattern', max_labels_count = 500, max_lines_count = 500, max_boxes_count = 500, overlay = true)
//---------------------------------------------------------------------------------------------------------------------}
//Settings
//---------------------------------------------------------------------------------------------------------------------{
sp         =                              '            '
len        = input.int      (   5       ,    'Swings'      , minval=  1                               )
bull       = input.bool     ( true      ,  'Bullish SFP'                                              )
bear       = input.bool     ( true      ,  'Bearish SFP'                                              )

iVal       = input.string   ('None', 'Validation'+sp+ '   ', group='Volume Validation'
 , options =          ['Volume outside swing < Threshold'  ,'Volume outside swing > Threshold','None'])
percent    = input.float    (25, 'Volume Threshold %'      , inline='valy', group='Volume Validation'
 , tooltip =                    '% of Total Volume'        , minval=  0   , maxval=100                )
auto       = input.bool     (true,     ''                  , inline='auto', group='Volume Validation' )
mlt        = input.int      (50  ,  '      Auto' + sp      , inline='auto', group='Volume Validation' )
res        = input.timeframe('1' , sp +'   LTF'  + sp +'  ', inline='ltf' , group='Volume Validation' )
prem       = input.bool     (false   ,'    Premium'                       , group='Volume Validation'
 , tooltip =                        'Premium Plan or higher'                                          )
showDash   = input.bool     (true    , 'Show Dashboard'                   , group=    'Dashboard'     )
dashLoc    = input.string   (           'Top Right'        , 'Location'  
 , options =                ['Top Right', 'Bottom Right', 'Bottom Left']  , group=    'Dashboard'     )
textSize   = input.string   (             'Normal'         ,   'Size'      
 , options =                     ['Tiny', 'Small', 'Normal']              , group=    'Dashboard'     )
dSwingLine = input.bool     (true    ,  'Swing Lines'                     , group=      'Style'       )
dOpposLine = input.bool     (true    ,  'Confirmation Lines'              , group=      'Style'       )
dSFP_Line  = input.bool     (true    ,  'Swing Failure Wick'              , group=      'Style'       )
dSFP_Label = input.bool     (true    ,  'Swing Failure Label'             , group=      'Style'       )
colBl      = input.color    (#089981  , 'Lines / Labels' , inline='lin' , group=      'Style'       )
colBr      = input.color    (#f23645  ,   ''             , inline='lin' , group=      'Style'      
 , tooltip =                         'Bullish/Bearish'                                                )
colBl2     = input.color    (#08998180, 'SFP Wicks      ', inline='wic' , group=      'Style'       )
colBr2     = input.color    (#f2364580,   ''             , inline='wic' , group=      'Style'      
 , tooltip =                'Wick outside Swing, Bullish/Bearish'                                     )

//-----------------------------------------------------------------------------}      
//UDT
//-----------------------------------------------------------------------------{
type piv
    float swing_prc // price
    int   swing_bix // bar_index
    float oppos_prc // price
    int   oppos_bix // bar_index
    bool  active    
    bool  confirmed 
    line  swing_line 
    line  oppos_line 
    line  wicky_line
    label wicky_label

type swing 
    int   bix 
    float prc 

//-----------------------------------------------------------------------------}      
//Variables
//-----------------------------------------------------------------------------{
n   = bar_index 
INV = color(na)
FGc = chart.fg_color

table_position = dashLoc == 'Bottom Left' ? position.bottom_left 
  : dashLoc == 'Top Right' ? position.top_right 
  : position.bottom_right

table_size = textSize == 'Tiny' ? size.tiny 
  : textSize == 'Small' ? size.small 
  : size.normal

var tb = table.new(table_position, 2, 3
  , bgcolor      = #1e222d
  , border_color = #373a46
  , border_width = 1
  , frame_color  = #373a46
  , frame_width  = 1)

var swing swingH = swing.new() 
var swing swingL = swing.new() 
var piv pivH     = piv.new()
var piv pivL     = piv.new()

validate = iVal != 'None' 
valHigher= iVal == 'Volume outside swing > Threshold'
valLower = iVal == 'Volume outside swing < Threshold'

//---------------------------------------------------------------------------------------------------------------------}
//Method
//---------------------------------------------------------------------------------------------------------------------{
method n(float piv) => bool out = not na(piv)

//---------------------------------------------------------------------------------------------------------------------}
//Execution
//---------------------------------------------------------------------------------------------------------------------{
tfS  = timeframe.in_seconds(      res       )
tfC  = timeframe.in_seconds(timeframe.period)
rs   = auto ? tfC / mlt : tfS 
if not validate
    res := timeframe.period 
else
    rs  := prem ? rs : math.max(60, rs)
    res := timeframe.from_seconds(math.min(tfC, rs))

ph = ta.pivothigh(len, 1)
pl = ta.pivotlow (len, 1)

[ltf_close, ltf_volume] = request.security_lower_tf(syminfo.tickerid, res, [close, volume])

ltf_size = ltf_close.size()

if validate 
    if ltf_size > 0 and ltf_size[1] == 0 
        line.new(n, close, n, close + syminfo.mintick, color=color.silver, style=line.style_dotted, extend=extend.both)

//---------------------------------------------------------------------------------------------------------------------}
//Bearish Pattern
//---------------------------------------------------------------------------------------------------------------------{
if bear

    if ph.n() 
        swingH.bix := n-1 
        swingH.prc := ph 

    sw = swingH.prc
    bx = swingH.bix
    if high > sw 
     and open < sw
     and close < sw
        valid = true
        if validate 
            if ltf_close.size() > 0 
                outsideVolume = 0.
                totalVolume = ltf_volume.sum() 
                for j = 0 to ltf_close.size() -1 
                    if ltf_close.get(j) > sw
                        outsideVolume += ltf_volume.get(j)
                if (valHigher ? 100 / totalVolume * outsideVolume < percent 
                              : 100 / totalVolume * outsideVolume > percent 
                   )
                    valid := false

                //if valid 
                //    label.new(n, high, text=str.format("Total Volume: {0}\nWick Volume: {1}", totalVolume, outsideVolume))

        if valid 

            opposL = sw 
            opposB = n

            for i = 1 to n - bx -1
                if low [i] < opposL 
                    opposL := low [i]
                    opposB := n  - i

            if not pivH.confirmed
                pivH.swing_line .delete()
                pivH.oppos_line .delete()
                pivH.wicky_line .delete()                
                pivH.wicky_label.delete()

            pivH := piv.new(sw, bx, opposL, opposB, true, false)

            if dSwingLine 
                pivH.swing_line  := line.new (bx    , sw    , n, sw    , color=colBr)
            if dOpposLine 
                pivH.oppos_line  := line.new (opposB, opposL, n, opposL, color=colBr, style=line.style_dotted)
            if dSFP_Line 
                pivH.wicky_line  := line.new (n     , high  , n, sw    , color=colBr2, width=3)
            if dSFP_Label  
                pivH.wicky_label := label.new(n     , high
                 , style=label.style_label_down
                 , text='SFP', textcolor=colBr
                 , color=INV, size=size.normal
                 )

    if pivH.active and not pivH.confirmed 

        pivH.swing_line.set_x2(n)
        pivH.oppos_line.set_x2(n)

        if close < pivH.oppos_prc
            pivH.confirmed   := true
                
            if pivH.wicky_label.get_x() == n  
                pivH.wicky_label.set_text('SFP\n▼')
            else 
                label.new(n, high, style=label.style_label_down, text='▼', textcolor=colBr, color=INV, size=size.normal)

    if n - pivH.swing_bix > 500 
     or close > pivH.swing_prc
        pivH.active := false 
        if not pivH.confirmed
            pivH.swing_line .delete() 
            pivH.oppos_line .delete() 
            pivH.wicky_line .delete() 
            pivH.wicky_label.delete() 

//---------------------------------------------------------------------------------------------------------------------}
//Bullish Pattern
//---------------------------------------------------------------------------------------------------------------------{
if bull

    if pl.n() 
        swingL.bix := n-1 
        swingL.prc := pl 

    sw = swingL.prc
    bx = swingL.bix
    if low  < sw 
     and open > sw
     and close > sw
        valid = true
        if validate 
            if ltf_close.size() > 0 
                outsideVolume = 0.
                totalVolume = ltf_volume.sum() 
                for j = 0 to ltf_close.size() -1 
                    if ltf_close.get(j) < sw
                        outsideVolume += ltf_volume.get(j)
                if (valHigher ? 100 / totalVolume * outsideVolume < percent 
                              : 100 / totalVolume * outsideVolume > percent 
                   )
                    valid := false
        if valid 

            opposH = sw 
            opposB = n

            for i = 1 to n - bx -1
                if high[i] > opposH 
                    opposH := high[i]
                    opposB := n - i

            if not pivL.confirmed
                pivL.swing_line .delete()
                pivL.oppos_line .delete()
                pivL.wicky_line .delete()                
                pivL.wicky_label.delete()

            pivL := piv.new(sw, bx, opposH, opposB, true, false)

            if dSwingLine 
                pivL.swing_line  := line.new (bx    , sw    , n, sw    , color=colBl )
            if dOpposLine 
                pivL.oppos_line  := line.new (opposB, opposH, n, opposH, color=colBl , style=line.style_dotted)
            if dSFP_Line 
                pivL.wicky_line  := line.new (n     , low   , n, sw    , color=colBl2, width=3)
            if dSFP_Label  
                pivL.wicky_label := label.new(n     , low  
                 , style=label.style_label_up
                 , text='SFP', textcolor=colBl
                 , color=INV, size=size.normal
                 )

    if pivL.active and not pivL.confirmed 

        pivL.swing_line.set_x2(n)
        pivL.oppos_line.set_x2(n)

        if close > pivL.oppos_prc
            pivL.confirmed   := true
                
            if pivL.wicky_label.get_x() == n  
                pivL.wicky_label.set_text('▲\nSFP')
            else 
                label.new(n, low, style=label.style_label_up, text='▲', textcolor=colBl, color=INV, size=size.normal)

    if n - pivL.swing_bix > 500 
     or close < pivL.swing_prc
        pivL.active := false 
        if not pivL.confirmed
            pivL.swing_line .delete() 
            pivL.oppos_line .delete() 
            pivL.wicky_line .delete() 
            pivL.wicky_label.delete() 

//---------------------------------------------------------------------------------------------------------------------}
//Dashboard
//---------------------------------------------------------------------------------------------------------------------{
if barstate.islast and validate and showDash
    tb.cell(0, 0, str.format("LTF: {0}", res), text_color=color.white, text_size=table_size)

//---------------------------------------------------------------------------------------------------------------------}