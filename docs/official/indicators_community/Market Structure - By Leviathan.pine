// This source code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/
// © Leviathan
// Swing point generation inspired by @BacktestRookies

//@version=5
indicator("Market Structure - By Leviathan", overlay=true, max_labels_count=500, max_lines_count=500)

// Constants
color CLEAR = color.rgb(0,0,0,100)

// Inputs
swingSize = input.int(20, 'Swing Length', tooltip='The number of left and right bars checked when searching for a swing point. Higher value = less swing points plotted and lower value = more swing points plotted.' )
bosConfType = input.string('Candle Close', 'BOS Confirmation', ['Candle Close', 'Wicks'], tooltip='Choose whether candle close/wick above previous swing point counts as a BOS.')
choch = input.bool(false, 'Show CHoCH', tooltip='Renames the first counter trend BOS to CHoCH' )
showSwing = input.bool(true, 'Show Swing Points', tooltip='Show or hide HH, LH, HL, LL')

showHalf = input.bool(false, 'Show 0.5 Retracement Level', group='0.5 Retracement Level', tooltip='Show a possible 0.5 retracement level between the swing highs and lows of an expansion move.')
halfColor = input.color(color.rgb(41, 39, 176), 'Color', group='0.5 Retracement Level')
halfStyle = input.string('Solid', 'Line Style', ['Solid', 'Dashed', 'Dotted'], group='0.5 Retracement Level')
halfWidth = input.int(1, 'Width', minval=1, group='0.5 Retracement Level')

bosColor = input.color(color.rgb(112, 114, 119), 'Color', group='BOS Settings')
bosStyle = input.string('Dashed', 'Line Style', ['Solid', 'Dashed', 'Dotted'], group='BOS Settings')
bosWidth = input.int(1, 'Width', minval=1, group='BOS Settings')

// Functions
lineStyle(x) =>
    switch x
        'Solid' => line.style_solid
        'Dashed' => line.style_dashed
        'Dotted' => line.style_dotted


// Calculations

//Finding high and low pivots
pivHi = ta.pivothigh(high, swingSize, swingSize)
pivLo = ta.pivotlow(low, swingSize, swingSize)


//Tracking the previous swing levels to determine hh lh hl ll
var float prevHigh = na
var float prevLow = na
var int prevHighIndex = na
var int prevLowIndex = na

//Tracking whether previous levels have been breached
var bool highActive = false
var bool lowActive = false

bool hh = false
bool lh = false
bool hl = false
bool ll = false

//Variable to track the previous swing type, used later on to draw 0.5 Retracement Levels (HH = 2, LH = 1, HL = -1, LL = -2)
var int prevSwing = 0

if not na(pivHi)
    if pivHi >= prevHigh
        hh := true
        prevSwing := 2
    else
        lh := true
        prevSwing := 1
    prevHigh := pivHi
    highActive := true
    prevHighIndex := bar_index - swingSize

if not na(pivLo)
    if pivLo >= prevLow
        hl := true
        prevSwing := -1
    else
        ll := true
        prevSwing := -2
    prevLow := pivLo
    lowActive := true
    prevLowIndex := bar_index - swingSize

//Generating the breakout signals
bool highBroken = false
bool lowBroken = false

//Tracking prev breakout
var int prevBreakoutDir = 0

float highSrc = bosConfType == 'Candle Close' ? close : high
float lowSrc = bosConfType == 'Candle Close' ? close : low

if highSrc > prevHigh and highActive
    highBroken := true
    highActive := false
if lowSrc < prevLow and lowActive
    lowBroken := true
    lowActive := false


// Visual Output

//Swing level labels
if hh and showSwing
    label.new(bar_index - swingSize, pivHi, 'HH', color=CLEAR, style=label.style_label_down, textcolor=chart.fg_color)
    //Detecting if it is a hh after a hl
    if prevSwing[1] == -1 and showHalf
        line.new(prevLowIndex, (prevLow + pivHi) / 2, bar_index - swingSize, (prevLow + pivHi) / 2, color=halfColor, style=lineStyle(halfStyle), width=halfWidth)
if lh and showSwing
    label.new(bar_index - swingSize, pivHi, 'LH', color=CLEAR, style=label.style_label_down, textcolor=chart.fg_color)
if hl and showSwing
    label.new(bar_index - swingSize, pivLo, 'HL', color=CLEAR, style=label.style_label_up, textcolor=chart.fg_color)
if ll and showSwing
    label.new(bar_index - swingSize, pivLo, 'LL', color=CLEAR, style=label.style_label_up, textcolor=chart.fg_color)
    //Detecting if it is a ll after a lh
    if prevSwing[1] == 1 and showHalf
        line.new(prevHighIndex, (prevHigh + pivLo) / 2, bar_index - swingSize, (prevHigh + pivLo) / 2, color=halfColor, style=lineStyle(halfStyle), width=halfWidth)

//Generating the BOS Lines
if highBroken
    line.new(prevHighIndex, prevHigh, bar_index, prevHigh, color=bosColor, style=lineStyle(bosStyle), width=bosWidth)
    label.new(math.floor(bar_index - (bar_index - prevHighIndex) / 2), prevHigh, prevBreakoutDir == -1 and choch ? 'CHoCH' : 'BOS', color=CLEAR, textcolor=bosColor, size=size.tiny)
    prevBreakoutDir := 1
if lowBroken
    line.new(prevLowIndex, prevLow, bar_index, prevLow, color=bosColor, style=lineStyle(bosStyle), width=bosWidth)
    label.new(math.floor(bar_index - (bar_index - prevLowIndex) / 2), prevLow, prevBreakoutDir == 1 and choch ? 'CHoCH' : 'BOS', color=CLEAR, textcolor=bosColor, style=label.style_label_up, size=size.tiny)
    prevBreakoutDir := -1