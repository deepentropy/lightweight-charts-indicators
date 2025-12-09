// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator('Swing Breakout Sequence [LuxAlgo]', 'LuxAlgo - Swing Breakout Sequence', overlay = true, max_lines_count = 500, max_labels_count = 500, max_polylines_count = 100, max_boxes_count = 500)
//---------------------------------------------------------------------------------------------------------------------}
//CONSTANTS & STRINGS & INPUTS
//---------------------------------------------------------------------------------------------------------------------{
BULLISH_LEG                 = 1
BEARISH_LEG                 = 0

HIGH                        = 1
LOW                         = 0

GREEN                       = #089981
RED                         = #F23645
GRAY                        = color.gray
BULLISH_BOX_COLOR           = color.new(GREEN,90)
BEARISH_BOX_COLOR           = color.new(RED,90)

DOUBLE_GROUP                = 'DETECTION'
STYLE_GROUP                 = 'STYLE'

pivotLengthTooltip          = 'Number of candles to confirm a swing high or swing low. A higher number detects larger swings.'
internalLengthTooltip       = 'Number of candles to confirm a internal high or internal low. A lower number detects smaller swings. It must be the same size or smaller than the swing length.'
point4Beyond2Tooltip        = 'It only detects sequences where Point 4 is beyond Point 2.'
detectPoint5Tooltip         = 'Enable/disable Point 5 detection.'
strictThresholdTooltip      = 'Enable/Disable double top/bottom detection at Point 5 within a given threshold. A bigger value detects more sequences.'
showPathTooltip             = 'Enable/disable a line between sequence points.'
bearishBoxColorTooltip      = 'Enable/disable colored boxes for each sequence.'
showLinesTooltip            = 'Enable/disable horizontal lines from each point of the sequence.'
autoColorTooltip            = 'Define the color or enable/disable auto color.'

pivotLengthInput            = input.int(    5,                  'Swing Length',                 group = '',             tooltip = pivotLengthTooltip,       minval = 2)
internalLengthInput         = input.int(    2,                  'Internal Length',              group = '',             tooltip = internalLengthTooltip,    minval = 2)
point4Beyond2Input          = input.bool(   false,              'Point 4 Beyond Point 2',       group = DOUBLE_GROUP,   tooltip = point4Beyond2Tooltip)
detectPoint5Input           = input.bool(   true,               'Show Point 5',                 group = DOUBLE_GROUP,   tooltip = detectPoint5Tooltip)
strictModeInput             = input.bool(   true,               'Require Equal H/L at Point 5', group = DOUBLE_GROUP,   tooltip = '',                       inline = 'strict')
strictThresholdInput        = input.float(  0.50,               '',                             group = DOUBLE_GROUP,   tooltip = strictThresholdTooltip,   inline = 'strict', step = 0.05) * ta.atr(200)
showPathInput               = input.bool(   false,              'Show Sequence Path',           group = STYLE_GROUP,    tooltip = showPathTooltip)
showBoxInput                = input.bool(   true,               'Show Boxes',                   group = STYLE_GROUP,    tooltip = '',                       inline = 'box')
bullishBoxColorInput        = input.color(  BULLISH_BOX_COLOR,  '',                             group = STYLE_GROUP,    tooltip = '',                       inline = 'box')
bearishBoxColorInput        = input.color(  BEARISH_BOX_COLOR,  '',                             group = STYLE_GROUP,    tooltip = bearishBoxColorTooltip,   inline = 'box')
showLinesInput              = input.bool(   true,               'Show Lines',                   group = STYLE_GROUP,    tooltip = showLinesTooltip)
defaultColorInput           = input.color(  GRAY,               'Default Color',                group = STYLE_GROUP,    tooltip = '',                       inline = 'color')
autoColorInput              = input.bool(   true,               'Auto',                         group = STYLE_GROUP,    tooltip = autoColorTooltip,         inline = 'color')

//---------------------------------------------------------------------------------------------------------------------}
//DATA STRUCTURES & VARIABLES
//---------------------------------------------------------------------------------------------------------------------{
// @type                    Storage UDT for pivot points
// @field barTime           Time index of the privot point     
// @field barIndex          Bar index of the privot point
// @field priceLevel        Price level of the pivot point
// @field leg               Bullish or bearish bias (1 or 0)
type swingPoint
    int barTime
    int barIndex
    float priceLevel
    int swing

// @type                    Storage UDT for sequences
// @field points            storage array for chart.point
type sbs    
    array<chart.point> points

// @variable                        storage array for `sbs` UDTs
var array<sbs> sequences            = array.new<sbs>()
// @variable                        storage array for `swingPoint` UDTs
var array<swingPoint> swingPoints   = array.new<swingPoint>()
// @variable                        storage array for `swingPoint` UDTs
var array<swingPoint> internalPoints = array.new<swingPoint>()

// @variable                        current leg bullish or bearish bias (1 or 0)
int currentLeg                      = na
// @variable                        true if there is a new pivot
bool newPivot                       = na
// @variable                        true if there is a new pivot low
bool pivotLow                       = na
// @variable                        true if there is a new pivot high
bool pivotHigh                      = na

// @variable                        current internal leg bullish or bearish bias (1 or 0)
int internalLeg                     = na
// @variable                        true if there is a new internal pivot
bool newInternalPivot               = na
// @variable                        true if there is a new internal pivot low
bool internalLow                    = na
// @variable                        true if there is a new internal pivot high
bool internalHigh                   = na

// @variable                        last swing bar index 
var int legIndex                    = bar_index
// @variable                        last swing high 
var float legHigh                   = high
// @variable                        last swing low 
var float legLow                    = low
// @variable                        last swing bar time
var int legTime                     = time

// @variable                        last internal bar index
var int internalLegIndex            = bar_index
// @variable                        last internal high
var float internalLegHigh           = high
// @variable                        last internal low
var float internalLegLow            = low
// @variable                        last internal bar time
var int internalLegTime             = time

//---------------------------------------------------------------------------------------------------------------------}
//USER-DEFINED FUNCTIONS
//---------------------------------------------------------------------------------------------------------------------{
// @function            Get the value of the current leg, it can be 0 (bearish) or 1 (bullish)
// @returns             int
leg(int length) =>
    var leg     = 0
    newLegHigh  = high  == ta.highest( length)
    newLegLow   = low   == ta.lowest(  length)
    
    if newLegHigh
        leg := BULLISH_LEG
    else if newLegLow
        leg := BEARISH_LEG
    leg

// @function            Identify whether the current value is the start of a new leg (swing)
// @param leg           (int) Current leg value
// @returns             bool
startOfNewLeg(int leg)      => ta.change(leg) != 0

// @function            Identify whether the current level is the start of a new bearish leg (swing)
// @param leg           (int) Current leg value
// @returns             bool
startOfBearishLeg(int leg)  => ta.change(leg) == -1

// @function            Identify whether the current level is the start of a new bullish leg (swing)
// @param leg           (int) Current leg value
// @returns             bool
startOfBullishLeg(int leg)  => ta.change(leg) == +1

// @function            Parses swingPoint to chart.point
// @param point         swingPoint to parse
// @returns             chart.point ID
chartPoint(swingPoint point) => chart.point.new(point.barTime, point.barIndex, point.priceLevel)

// @function            True if point price is between top and bottom prices
// @param point         swingPoint to check
// @param top           top swingPoint
// @param bottom        bottom swingPoint
// @returns             bool
inside(swingPoint point, swingPoint top, swingPoint bottom) => point.priceLevel <= top.priceLevel and point.priceLevel >= bottom.priceLevel

// @function            True if point price is between top and bottom prices
// @param point         swingPoint to check
// @param top           top price
// @param bottom        bottom price
// @returns             bool
insideLevel(swingPoint point, float top, float bottom) => point.priceLevel <= top and point.priceLevel >= bottom

// @function            Detects and returns a swingPoint after point4 with similar price within top and bottom swingPoints
// @param point4        swingPoint to check
// @param top           top swingPoint
// @param bottom        bottom swingPoint
// @returns             swingPoint ID
doubleTopBottom(swingPoint point4,swingPoint top,swingPoint bottom) =>
    swingPoint point5 = na
    for eachPoint in internalPoints
        if eachPoint.barIndex > point4.barIndex and eachPoint.swing == point4.swing and (strictModeInput ? insideLevel(eachPoint,point4.priceLevel+strictThresholdInput,point4.priceLevel-strictThresholdInput) : inside(eachPoint,top,bottom))
            point5 := eachPoint
            break
    point5

// @function            Draws last detected SBS
// @returns             void
plotLastSBS() =>
    color   defaultColor        = autoColorInput ? chart.fg_color : defaultColorInput
    int     concurrentSequences = 0
    string  textFix             = ''
    sbs     lastSBS             = sequences.last()
    bool    bullishSequence     = lastSBS.points.first().price > lastSBS.points.get(1).price
    
    for [index,eachSBS] in sequences
        if index >= 1
            if eachSBS.points.first().index < sequences.get(index - 1).points.last().index
                concurrentSequences += 1
            else
                concurrentSequences := 0
    
    if concurrentSequences > 0
        baseString  = str.tostring(array.new<string>(concurrentSequences,'\n'))
        textFix     := str.replace_all(str.substring(baseString,1,str.length(baseString)-1),', ','')          

    if showBoxInput
        color boxColor  = bullishSequence ? BULLISH_BOX_COLOR               : BEARISH_BOX_COLOR
        float top       = bullishSequence ? lastSBS.points.first().price    : lastSBS.points.get(1).price
        float bottom    = bullishSequence ? lastSBS.points.get(1).price     : lastSBS.points.first().price

        box.new(lastSBS.points.first().time,top,lastSBS.points.last().time,bottom,xloc = xloc.bar_time,bgcolor = boxColor,border_width = 0)

    if showPathInput
        polyline.new(lastSBS.points, false, false, xloc.bar_time, color.new(defaultColor,50), line_style = line.style_solid, line_width = 2)

    if showLinesInput            
        line.new(lastSBS.points.first().time,lastSBS.points.first().price,lastSBS.points.get(2).time,lastSBS.points.first().price,xloc.bar_time,color = defaultColor,style = line.style_dotted)
        line.new(lastSBS.points.get(1).time,lastSBS.points.get(1).price,lastSBS.points.last().time,lastSBS.points.get(1).price,xloc.bar_time,color = defaultColor,style = line.style_dotted)
        line.new(lastSBS.points.get(2).time,lastSBS.points.get(2).price,lastSBS.points.last().time,lastSBS.points.get(2).price,xloc.bar_time,color = defaultColor,style = line.style_dotted)
        line.new(lastSBS.points.get(3).time,lastSBS.points.get(3).price,lastSBS.points.last().time,lastSBS.points.get(3).price,xloc.bar_time,color = defaultColor,style = line.style_dotted)
        line.new(lastSBS.points.get(4).time,lastSBS.points.get(4).price,lastSBS.points.last().time,lastSBS.points.get(4).price,xloc.bar_time,color = defaultColor,style = line.style_dotted)

        if detectPoint5Input
            line.new(lastSBS.points.get(5).time,lastSBS.points.get(5).price,lastSBS.points.last().time,lastSBS.points.get(5).price,xloc.bar_time,color = defaultColor,style = line.style_dotted)
                        
    label.new(lastSBS.points.first(),bullishSequence ? 'Swing High' + textFix : textFix + 'Swing Low',xloc.bar_time,color = color(na),style = bullishSequence ? label.style_label_down : label.style_label_up,textcolor = defaultColor)
    label.new(lastSBS.points.get(1),bullishSequence ? textFix + 'Swing Low' : 'Swing High' + textFix,xloc.bar_time,color = color(na),style = bullishSequence ? label.style_label_up : label.style_label_down,textcolor = defaultColor)
    label.new(lastSBS.points.get(2),bullishSequence ? '1' + textFix : textFix + '1',xloc.bar_time,color = color(na),style = bullishSequence ? label.style_label_down : label.style_label_up,textcolor = defaultColor)
    label.new(lastSBS.points.get(3),bullishSequence ? textFix + '2' : '2' + textFix,xloc.bar_time,color = color(na),style = bullishSequence ? label.style_label_up : label.style_label_down,textcolor = defaultColor)
    label.new(lastSBS.points.get(4),bullishSequence ? '3' + textFix : textFix + '3',xloc.bar_time,color = color(na),style = bullishSequence ? label.style_label_down : label.style_label_up,textcolor = defaultColor)
    label.new(lastSBS.points.get(5),bullishSequence ? textFix + '4' : '4' + textFix,xloc.bar_time,color = color(na),style = bullishSequence ? label.style_label_up : label.style_label_down,textcolor = defaultColor)

    if detectPoint5Input
        label.new(lastSBS.points.last(),bullishSequence ? textFix + '5' : '5' + textFix,xloc.bar_time,color = color(na),style = bullishSequence ? label.style_label_up : label.style_label_down,textcolor = defaultColor)

// @function            Finds and plots sequences with internal swing detector
// @returns             void
gatherInternalSBS() =>
    size = array.size(swingPoints)

    if size >= 6        
        A               = array.get(swingPoints, size - 6)
        B               = array.get(swingPoints, size - 5)        
        point1          = array.get(swingPoints, size - 4)
        point2          = array.get(swingPoints, size - 3)
        point3          = array.get(swingPoints, size - 2)
        point4          = array.get(swingPoints, size - 1)

        swingPoint doubleTopPoint       = na
        swingPoint doubleBottomPoint    = na

        if detectPoint5Input
            doubleTopPoint      := doubleTopBottom(point4,B,A)
            doubleBottomPoint   := doubleTopBottom(point4,A,B)
    
        bearishSBS = point1.swing == LOW and inside(point1,A,point3) and inside(point2,B,A) and (point4Beyond2Input ? inside(point4,B,point2) : inside(point4,B,A)) and (detectPoint5Input ? not na(doubleTopPoint) : true)
        bullishSBS = point1.swing == HIGH and inside(point1,point3,A) and inside(point2,A,B) and (point4Beyond2Input ? inside(point4,point2,B) : inside(point4,A,B)) and (detectPoint5Input ? not na(doubleBottomPoint) : true)        
        
        if bullishSBS or bearishSBS            
            bool addSequence = false

            if sequences.size() == 0
                addSequence := true
            else if sequences.last().points.first().time < A.barTime
                addSequence := true

            if addSequence
                sequences.push(sbs.new(array.from(chartPoint(A),chartPoint(B),chartPoint(point1),chartPoint(point2),chartPoint(point3),chartPoint(point4))))            

                if detectPoint5Input                    
                    sequences.last().points.push(chartPoint(bullishSBS ? doubleBottomPoint : doubleTopPoint))         

                plotLastSBS()   
                                                                           
// @function            Finds and plots sequences with swing detector
// @returns             void
gatherSwingSBS() =>
    size = array.size(swingPoints)

    if size >= 8        
        A               = array.get(swingPoints, size - 8)
        B               = array.get(swingPoints, size - 7)        
        point1          = array.get(swingPoints, size - 6)
        point2          = array.get(swingPoints, size - 5)
        point3          = array.get(swingPoints, size - 4)
        point4          = array.get(swingPoints, size - 3)
        point5          = array.get(swingPoints, size - 2)
        point6          = array.get(swingPoints, size - 1)                        

        bearishSBS = point1.swing == LOW and inside(point1,A,point3) and inside(point2,B,A) and (point4Beyond2Input ? inside(point4,B,point2) : inside(point4,B,A)) and (detectPoint5Input ? (strictModeInput ? insideLevel(point6,point4.priceLevel+strictThresholdInput,point4.priceLevel-strictThresholdInput) : inside(point6,B,A)) : true)
        bullishSBS = point1.swing == HIGH and inside(point1,point3,A) and inside(point2,A,B) and (point4Beyond2Input ? inside(point4,point2,B) : inside(point4,A,B)) and (detectPoint5Input ? (strictModeInput ? insideLevel(point6,point4.priceLevel+strictThresholdInput,point4.priceLevel-strictThresholdInput) : inside(point6,A,B)) : true)

        if bullishSBS or bearishSBS            
            bool addSequence = false

            if sequences.size() == 0
                addSequence := true
            else if sequences.last().points.first().time < A.barTime
                addSequence := true

            if addSequence
                sequences.push(sbs.new(array.from(chartPoint(A),chartPoint(B),chartPoint(point1),chartPoint(point2),chartPoint(point3),chartPoint(point4))))

                if detectPoint5Input                    
                    sequences.last().points.push(chartPoint(point6))

                plotLastSBS()        
                        
// @function            Add a swingPoint point to an array points with a provided max number of elements
// @param point         swingPoint to add
// @param points        array of swingPoint
// @param size          max size of array
// @returns             void
addPoint(swingPoint point, array<swingPoint> points, int size) =>
    if points.size() >= size
        points.shift()
        
    points.push(point)
    
//---------------------------------------------------------------------------------------------------------------------}
//MUTABLE VARIABLES & EXECUTION
//---------------------------------------------------------------------------------------------------------------------{
currentLeg          := leg(pivotLengthInput)
newPivot            := startOfNewLeg(currentLeg)
pivotLow            := startOfBullishLeg(currentLeg)
pivotHigh           := startOfBearishLeg(currentLeg)

internalLeg         := leg(internalLengthInput)
newInternalPivot    := startOfNewLeg(internalLeg)
internalLow         := startOfBullishLeg(internalLeg)
internalHigh        := startOfBearishLeg(internalLeg)

// we execute the logic only once per bar close
if barstate.isconfirmed    
    
    // if there is a new swing point execute the logic
    if newInternalPivot
        priceLevel      = internalLegHigh
        legBias         = HIGH

        // if the new swing point is a pivot low change the values
        if internalLow            
            priceLevel  := internalLegLow
            legBias     := LOW

        // we store the new swing point
        addPoint(swingPoint.new(internalLegTime,internalLegIndex,priceLevel,legBias),internalPoints,pivotLengthInput)

        // we check and plot new sequence
        gatherInternalSBS()

    // we update the current leg values: high, low, index and time
    internalLegHigh     := internalLow  ? high  : math.max(high,internalLegHigh)
    internalLegLow      := internalHigh ? low   : math.min(low, internalLegLow)
    internalLegIndex    := (internalLeg == BULLISH_LEG and internalLegHigh == high) or (internalLeg == BEARISH_LEG and internalLegLow == low) ? bar_index   : internalLegIndex
    internalLegTime     := (internalLeg == BULLISH_LEG and internalLegHigh == high) or (internalLeg == BEARISH_LEG and internalLegLow == low) ? time        : internalLegTime
    
    // if there is a new swing point execute the logic    
    if newPivot
        priceLevel      = legHigh
        legBias         = HIGH

        // if the new swing point is a pivot low change the values
        if pivotLow
            priceLevel  := legLow
            legBias     := LOW

        // we store the new swing point
        addPoint(swingPoint.new(legTime,legIndex,priceLevel,legBias),swingPoints,8)

        // we check and plot new sequence
        gatherSwingSBS()
    
    // we update the current leg values: high, low, index and time
    legHigh     := pivotLow     ? high  : math.max(high,legHigh)
    legLow      := pivotHigh    ? low   : math.min(low, legLow)    
    legIndex    := (currentLeg == BULLISH_LEG and legHigh == high) or (currentLeg == BEARISH_LEG and legLow == low) ? bar_index : legIndex
    legTime     := (currentLeg == BULLISH_LEG and legHigh == high) or (currentLeg == BEARISH_LEG and legLow == low) ? time      : legTime
    
//---------------------------------------------------------------------------------------------------------------------}