// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo
//@version=5

indicator("Pure Price Action Structures [LuxAlgo]", 'LuxAlgo - Pure Price Action Structures', true, max_labels_count = 500, max_boxes_count = 500, max_lines_count = 500)
//---------------------------------------------------------------------------------------------------------------------
// Settings 
//---------------------------------------------------------------------------------------------------------------------{

display  = display.all - display.status_line

stGroup = 'Short Term Structures'
stSwings = input.string('Disabled', 'Swings', options = ['⦁', 'ST(H/L)', 'Disabled'], inline = 'NA', group = stGroup, display = display)
stSwingsSZ  = input.string('Tiny', 'Size', options = ['Tiny', 'Small', 'Normal', 'Large'], inline = 'NA', group = stGroup, display = display)
stMarketStructures = input.bool(true, 'Market Structures', group = stGroup)
stMSTextT = input.string('Disabled', '  Market Structure Labels', options = ['Enabled', 'Disabled'], group = stGroup, display = display), stMSText = stMSTextT == 'Enabled'
stMSLineStyle = input.string('Dotted', '  Line Style', options = ['Solid', 'Dashed', 'Dotted'], group = stGroup, inline = 'LN', display = display)
stMSLineWidth = input.int(1, 'Width', minval = 1, group = stGroup, inline = 'LN', display = display)
stBullMSColor = input.color(#089981, 'Swing and Line Colors, Bullish', group = stGroup, inline = 'MS')
stBearMSColor = input.color(#f23645, 'Bearish', group = stGroup, inline = 'MS')

itGroup = 'Intermediate Term Structures'
itSwings = input.string('Disabled', 'Swings', options = ['◈', '△▽', 'IT(H/L)', 'Disabled'], inline = 'NA', group = itGroup, display = display)
itSwingsSZ  = input.string('Small', 'Size', options = ['Tiny', 'Small', 'Normal', 'Large'], inline = 'NA', group = itGroup, display = display)
itMarketStructures = input.bool(true, 'Market Structures', group = itGroup)
itMSTextT = input.string('Disabled', '  Market Structure Labels', options = ['Enabled', 'Disabled'], group = itGroup, display = display), itMSText = itMSTextT == 'Enabled'
itMSLineStyle = input.string('Dashed', '  Line Style', options = ['Solid', 'Dashed', 'Dotted'], group = itGroup, inline = 'LN', display = display)
itMSLineWidth = input.int(1, 'Width', minval = 1, group = itGroup, inline = 'LN', display = display)
itBullMSColor = input.color(#089981, 'Swing and Line Colors, Bullish', group = itGroup, inline = 'MS')
itBearMSColor = input.color(#f23645, 'Bearish', group = itGroup, inline = 'MS')

ltGroup = 'Long Term Structures'
ltSwings = input.string('◉', 'Swings', options = ['◉', '▲▼', 'LT(H/L)', 'Disabled'], inline = 'NA', group = ltGroup, display = display)
ltSwingsSZ  = input.string('Normal', 'Size', options = ['Tiny', 'Small', 'Normal', 'Large'], inline = 'NA', group = ltGroup, display = display)
ltMarketStructures = input.bool(true, 'Market Structures', group = ltGroup)
ltMSTextT = input.string('Enabled', '  Market Structure Labels', options = ['Enabled', 'Disabled'], group = ltGroup, display = display), ltMSText = ltMSTextT == 'Enabled'
ltMSLineStyle = input.string('Solid', '  Line Style', options = ['Solid', 'Dashed', 'Dotted'], group = ltGroup, inline = 'LN', display = display)
ltMSLineWidth = input.int(1, 'Width', minval = 1, group = ltGroup, inline = 'LN', display = display)
ltBullMSColor = input.color(#089981, 'Swing and Line Colors, Bullish', group = ltGroup, inline = 'MS')
ltBearMSColor = input.color(#f23645, 'Bearish', group = ltGroup, inline = 'MS')

//---------------------------------------------------------------------------------------------------------------------}
// User Defined Types
//---------------------------------------------------------------------------------------------------------------------{

type BAR
    float   open  = open
    float   high  = high
    float   low   = low
    float   close = close
    int     index = bar_index

type ICTMS
    float   lastPrice
    float   midPrice
    float   prevPrice

    int     lastIndex
    int     midIndex
    int     prevIndex

    label   lastLabel
    label   midLabel
    label   prevLabel

    bool    isCrossed

    int     marketStructure

    line    msLine
    box     msLabel

type MS
    int type = 0

//---------------------------------------------------------------------------------------------------------------------}
// Generic Variables
//---------------------------------------------------------------------------------------------------------------------{

BAR bar = BAR.new()

//---------------------------------------------------------------------------------------------------------------------}
// Functions / Methods
//---------------------------------------------------------------------------------------------------------------------{

textSize(sizeInText) =>
    switch sizeInText
        'Tiny'   => size.tiny
        'Small'  => size.small
        'Normal' => size.normal
        => size.large

lineStyle(styleInText) =>
    switch styleInText
        'Solid'     => line.style_solid
        'Dotted'    => line.style_dotted
        'Dashed'    => line.style_dashed

queryPatterns(lastPrice, midPrice, prevPrice, isSwingHigh) =>
    if isSwingHigh
        prevPrice < midPrice and midPrice >= lastPrice
    else
        prevPrice > midPrice and midPrice <= lastPrice

method queryPatterns(ICTMS this, isSwingHigh) =>
    if isSwingHigh
        this.prevPrice < this.midPrice and this.midPrice >= this.lastPrice
    else
        this.prevPrice > this.midPrice and this.midPrice <= this.lastPrice

method updatePattern(ICTMS this, price, index) =>
    this.isCrossed := false
    this.prevPrice := this.midPrice, this.midPrice := this.lastPrice, this.lastPrice := price
    this.prevIndex := this.midIndex, this.midIndex := this.lastIndex, this.lastIndex := index
    this.prevLabel := this.midLabel, this.midLabel := this.lastLabel

method setType(MS this, value) =>
    this.type := value

method renderStructures(ICTMS this, isBullish, marketStructure, termText, color, style, width, labelEnabled) =>

    condition = isBullish ? bar.close > this.lastPrice : bar.close < this.lastPrice

    if condition and not this.isCrossed
        this.isCrossed := true
        this.msLine := line.new(this.lastIndex, this.lastPrice, bar.index, this.lastPrice, color = color, style = lineStyle(style), width = width)

        if labelEnabled
            this.msLabel := box.new(this.lastIndex, this.lastPrice, bar.index, this.lastPrice, color(na), bgcolor = color(na), 
             text = marketStructure.type == (isBullish ? -1 : 1) ? termText + '-MSS' : termText + '-BOS', text_size = size.tiny, text_halign = text.align_left, text_valign = isBullish ? text.align_bottom : text.align_top, text_color = color.new(color, 17))

        marketStructure.setType(isBullish ? 1 : -1)

//---------------------------------------------------------------------------------------------------------------------}
// Calculations - ICT Short Term Market Structures 
//---------------------------------------------------------------------------------------------------------------------{

var ICTMS stLow  = ICTMS.new()
var ICTMS stHigh = ICTMS.new()
var MS stMS = MS.new()

if queryPatterns(bar.low, bar.low[1], bar.low[2], false)
    stLow.updatePattern(bar.low[1], bar.index[1])
    TX = stSwings == '⦁' ? '⦁' : stLow.midPrice > stLow.lastPrice ? 'ST-LL' : 'ST-LH'
    stLow.lastLabel := label.new(stLow.lastIndex, stLow.lastPrice, TX, color = color(na), textcolor = stSwings != 'Disabled' ? stBearMSColor : color(na), style = label.style_label_up, size = textSize(stSwingsSZ))

if queryPatterns(bar.high, bar.high[1], bar.high[2], true)
    stHigh.updatePattern(bar.high[1], bar.index[1])
    TX = stSwings == '⦁' ? '⦁' : stHigh.midPrice > stHigh.lastPrice ? 'ST-HL' : 'ST-HH'
    stHigh.lastLabel := label.new(bar.index[1], bar.high[1], TX, color = color(na), textcolor = stSwings != 'Disabled' ? stBullMSColor : color(na), style = label.style_label_down, size = textSize(stSwingsSZ))

if stMarketStructures
    stLow.renderStructures(false, stMS, 'ST', stBearMSColor, stMSLineStyle, stMSLineWidth, stMSText)
    stHigh.renderStructures(true, stMS, 'ST', stBullMSColor, stMSLineStyle, stMSLineWidth, stMSText)

//---------------------------------------------------------------------------------------------------------------------}
// Calculations - ICT Intermediate Term Market Structures 
//---------------------------------------------------------------------------------------------------------------------{

var ICTMS itLow  = ICTMS.new()
var ICTMS itHigh = ICTMS.new()
var MS itMS = MS.new()

cITL = stLow.queryPatterns(false) 

if cITL and cITL != cITL[1]
    itLow.updatePattern(stLow.midPrice, stLow.midIndex)

    itLow.lastLabel := stLow.midLabel

    if itSwings != 'Disabled'
        TX = itSwings == '△▽' ? '△' : itSwings == '◈' ? '◈' : itLow.lastPrice > itLow.midPrice ? 'IT-LH' : 'IT-LL'
        stLow.midLabel.set_text(TX)
        stLow.midLabel.set_size(textSize(itSwingsSZ))
        stLow.midLabel.set_textcolor(itBearMSColor)

cITH = stHigh.queryPatterns(true) 

if cITH and cITH != cITH[1]
    itHigh.updatePattern(stHigh.midPrice, stHigh.midIndex)

    itHigh.lastLabel := stHigh.midLabel

    if itSwings != 'Disabled'
        TX = itSwings == '△▽' ? '▽' : itSwings == '◈' ? '◈' : itHigh.lastPrice > itHigh.midPrice ? 'IT-HH' : 'IT-HL'
        stHigh.midLabel.set_text(TX)
        stHigh.midLabel.set_size(textSize(itSwingsSZ))
        stHigh.midLabel.set_textcolor(itBullMSColor)

if itMarketStructures
    itLow.renderStructures(false, itMS, 'IT', itBearMSColor, itMSLineStyle, itMSLineWidth, itMSText)
    itHigh.renderStructures(true, itMS, 'IT', itBullMSColor, itMSLineStyle, itMSLineWidth, itMSText)

//---------------------------------------------------------------------------------------------------------------------}
// Calculations - ICT Long Term Market Structures 
//---------------------------------------------------------------------------------------------------------------------{

var ICTMS ltLow  = ICTMS.new()
var ICTMS ltHigh = ICTMS.new()
var MS ltMS = MS.new()

cLTL = itLow.queryPatterns(false)

if cLTL and cLTL != cLTL[1]
    ltLow.isCrossed := false

    TX = ltSwings == '▲▼' ? '▲' : ltSwings == '◉' ? '◉' : ltLow.lastPrice > itLow.midPrice ? 'LT-LL' : 'LT-LH'

    ltLow.lastPrice := itLow.midPrice
    ltLow.lastIndex := itLow.midIndex

    if ltSwings != 'Disabled'
        itLow.midLabel.set_text(TX)
        itLow.midLabel.set_size(textSize(ltSwingsSZ))
        itLow.midLabel.set_textcolor(ltBearMSColor)

cLTH = itHigh.queryPatterns(true)

if cLTH and cLTH != cLTH[1]
    ltHigh.isCrossed := false

    TX = ltSwings == '▲▼' ? '▼' : ltSwings == '◉' ? '◉' : ltHigh.lastPrice > itHigh.midPrice ? 'LT-HL' : 'LT-HH'

    ltHigh.lastPrice := itHigh.midPrice
    ltHigh.lastIndex := itHigh.midIndex

    if ltSwings != 'Disabled'
        itHigh.midLabel.set_text(TX)
        itHigh.midLabel.set_size(textSize(ltSwingsSZ))
        itHigh.midLabel.set_textcolor(ltBullMSColor)

if ltMarketStructures
    ltLow.renderStructures(false, ltMS, 'LT', ltBearMSColor, ltMSLineStyle, ltMSLineWidth, ltMSText)
    ltHigh.renderStructures(true, ltMS, 'LT', ltBullMSColor, ltMSLineStyle, ltMSLineWidth, ltMSText)

//---------------------------------------------------------------------------------------------------------------------}