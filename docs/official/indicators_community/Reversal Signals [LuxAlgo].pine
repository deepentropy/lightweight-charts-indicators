// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo 
//@version=5

indicator("Reversal Signals [LuxAlgo]", "LuxAlgo - Reversal Signals", true, max_labels_count = 500, max_bars_back = 5000)

//------------------------------------------------------------------------------
// Settings
//-----------------------------------------------------------------------------{

bGR  = 'Momentum Phase'
bTP  = 'Momentum phase provides an indication of the initial trend\'s momentum and identifies a point of a likely top or bottom in the ranging markets\n\n' +
         'Completed - dislays only completed momentum phases\n' +
         'Detailed - displays all counting process of the momentum phases\nNone - disables the display of the momentum phases'

bSh  = input.string('Completed', 'Display Phases', options = ['Completed', 'Detailed', 'None'], group = bGR, tooltip = bTP)
srL  = input.bool(true , 'Support & Resistance Levels', inline = 'bSh', group = bGR)
ptLT = input.string('Step Line w/ Diamonds', '', options = ['Circles', 'Step Line', 'Step Line w/ Diamonds'], inline = 'bSh', group = bGR)
rsB  = input.bool(false, 'Momentum Phase Risk Levels', inline = 'bSh2', group = bGR)
ptSR = input.string('Circles', '', options = ['Circles', 'Step Line'], inline = 'bSh2', group = bGR)

eGR  = 'Trend Exhaustion Phase'
eTP  = 'Trend exhaustion phase aims to identify when the trend is fading/exhausting and possibly starting to reverse. The trend exhaustion phase starts only if a momentum phase is already established\n\n' +
         'Completed - dislays only completed trend exhaustion phases\n' +
         'Detailed - displays all counting process of the trend exhaustion phases\nNone - disables the display of the trend exhaustion phases'
eSh  = input.string('Completed', 'Display Phases', options = ['Completed', 'Detailed', 'None'], group = eGR, tooltip = eTP)
rsE  = input.bool(false, 'Trend Exhaustion Phase Risk Levels', group = eGR)
ttE  = input.bool(false, 'Trend Exhaustion Phase Target Levels', group = eGR)

tGR = 'Trade Setups'

tTP = 'All phase specific trade setups, presented as options, are triggered once the selected phase is completed and folowed by a price flip in the direction of the trade setup. Please pay attention to the phase specific risk levels as well as the overall trend direction\n' +
       '⚠️ Trading is subject to high risk, look first then leap\n\n' +
       'Tips : \n' +
       ' - Momentum trade setups are not recommended setups, and in case applied they best fit in ranging market\n' +
       '    a trade signal, followed immediately by a warning indication can be assumed as continuation of the underlying trend and can be traded in the opposite direction of the suggested signal\n\n' +
       ' -  Exhaustion / Qualified trade setups best fits in trending market\n' +
       '    Exhaustion, suggested type of trade setup, buy (sell) when buy (sell) trend exhaustion phase is complete\n' +
       '    Qualified, trend exhaustion phase followed by momentum phase is assumed as qualified trade setup'

tso = input.string('None', 'Phase Specific Trade Setup Options', options = ['Momentum', 'Exhaustion', 'Qualified', 'None'], group = tGR, tooltip = tTP)
war = input.bool(false , 'Price Flips against the Phase Specific Trade Setups', group = tGR)

//-----------------------------------------------------------------------------}
// General Calculations
//-----------------------------------------------------------------------------{

var BnoShw = false
Bcmpltd    = bSh == 'Completed' 
BnoShw    := bSh == 'None' ? false : true

var noShw = false
cmpltd    = eSh == 'Completed' 
noShw    := eSh == 'None' ? false : true

//-----------------------------------------------------------------------------}
// User Defined Types
//-----------------------------------------------------------------------------{

// @type        bar properties with their values 
//
// @field o     (float) open price of the bar
// @field h     (float) high price of the bar
// @field l     (float) low price of the bar
// @field c     (float) close price of the bar
// @field i     (int) index of the bar

type bar
    float o = open
    float h = high
    float l = low
    float c = close
    int   i = bar_index

// @type        momentum phase varaibles
//
// @field bSC   (int) bullish momentum phase count
// @field bSH   (float) bullish momentum phase high price value
// @field bSL   (float) bullish momentum phase lowest price value
//
// @field sSC   (int) bearish momentum phase count
// @field sSH   (float) bearish momentum phase highest price value
// @field sSL   (float) bearish momentum phase low price value

type trb 
    int   bSC
    float bSH
    float bSL

    int   sSC
    float sSH
    float sSL

// @type        trend exhaustion phase varaibles
//
// @field bCC   (int) bullish trend exhaustion phase count
// @field bC8   (float) bullish trend exhaustion phase 8 count's condition
// @field bCHt  (float) bullish trend exhaustion phase highest price value
// @field bCH   (float) bullish trend exhaustion phase high price value
// @field bCL   (float) bullish trend exhaustion phase low price value
// @field bCLt  (float) bullish trend exhaustion phase lowest price value
// @field bCD   (float) bullish trend exhaustion phase risk price value
//
// @field sCC   (int) bearish trend exhaustion phase count
// @field sC8   (float) bearish trend exhaustion phase 8 count's condition
// @field sCHt  (float) bearish trend exhaustion phase highest price value
// @field sCH   (float) bearish trend exhaustion phase high price value
// @field sCL   (float) bearish trend exhaustion phase low price value
// @field sCLt  (float) bearish trend exhaustion phase lowest price value
// @field sCT   (float) bearish trend exhaustion phase target price value

type tre 
    int   bCC
    float bC8
    float bCHt
    float bCH
    float bCL
    float bCLt
    float bCD

    int   sCC
    float sC8
    float sCHt
    float sCH
    float sCL
    float sCLt
    float sCT

//-----------------------------------------------------------------------------}
// Variables
//-----------------------------------------------------------------------------{

bar b = bar.new()
var trb S = trb.new()
var tre C = tre.new()

noC  = #00000000
rdC  = #f23645
gnC  = #089981
whC  = #ffffff
blC  = #2962ff
grC  = #787b86
bgC  = #00bcd4

shpD = shape.labeldown
shpU = shape.labelup
locA = location.abovebar
locB = location.belowbar
dspN = false
pltL = plot.style_circles
pltS = size.tiny

//-----------------------------------------------------------------------------}
// Functions / Methods
//-----------------------------------------------------------------------------{

// @function     alert function detecting crosses
//
// @param _p     (float) price value 
// @param _l     (float) checked level value
//
// return        (bool) true if condition mets, false otherwise 

f_xLX(_p, _l) =>
    (_l > _p and _l < _p[1]) or (_l < _p and _l > _p[1])


// @function     plot style function
//
// @param _p     (string) input string value 
//
// return        returns enumarated plot style value

f_lnS(_s) =>
    s = switch _s
        'Circles'               => plot.style_circles
        'Step Line'             => plot.style_steplinebr
        'Step Line w/ Diamonds' => plot.style_steplinebr

//-----------------------------------------------------------------------------}
// Calculations
//-----------------------------------------------------------------------------{

ptLB = f_lnS(ptLT)
ptRS = f_lnS(ptSR)

//-----------------------------------------------------------------------------}
// Momentum Phase
//-----------------------------------------------------------------------------{

con = b.c < b.c[4]

if con
    S.bSC := S.bSC == 9 ? 1 : S.bSC + 1
    S.sSC := 0
else
    S.sSC := S.sSC == 9 ? 1 : S.sSC + 1
    S.bSC := 0

pbS = (b.l <= b.l[3] and b.l <= b.l[2]) or (b.l[1] <= b.l[3] and b.l[1] <= b.l[2])

plotshape(BnoShw and not Bcmpltd and S.bSC == 1, '', shpD, locA, noC, 0, '₁', gnC, dspN)
plotshape(BnoShw and not Bcmpltd and S.bSC == 2, '', shpD, locA, noC, 0, '₂', gnC, dspN)
plotshape(BnoShw and not Bcmpltd and S.bSC == 3, '', shpD, locA, noC, 0, '₃', gnC, dspN)
plotshape(BnoShw and not Bcmpltd and S.bSC == 4, '', shpD, locA, noC, 0, '₄', gnC, dspN)
plotshape(BnoShw and not Bcmpltd and S.bSC == 5, '', shpD, locA, noC, 0, '₅', gnC, dspN)
plotshape(BnoShw and not Bcmpltd and S.bSC == 6, '', shpD, locA, noC, 0, '₆', gnC, dspN)
plotshape(BnoShw and not Bcmpltd and S.bSC == 7, '', shpD, locA, noC, 0, '₇', gnC, dspN)
plotshape(BnoShw and not Bcmpltd and S.bSC == 8 and not pbS, '', shpD, locA, noC, 0, '₈', gnC, dspN)
plotshape(BnoShw and not Bcmpltd and S.bSC == 8 and     pbS, '', shpD, locA, color.new(gnC, 75), 0, 'ᵖ\n₈', whC, dspN)
//plotshape(BnoShw and not Bcmpltd and S.bSC == 9, '', shpD,  locA, noC, 0, '₉', gnC, dspN)
plotshape(BnoShw and S.bSC == 9 and not pbS, 'Bullish Momentum Phases', shpU, locB, color.new(gnC, 25), 0, '', whC, not dspN, pltS)
plotshape(BnoShw and S.bSC == 9 and     pbS, 'Perfect Bullish Momentum Phases', shpU, locB, color.new(gnC, 25), 0, 'ᵖ', whC, not dspN, pltS)
plotshape(BnoShw and S.bSC[1] == 8 and S.sSC == 1, 'Early Bullish Momentum Phases', shpU, locB, color.new(gnC, 25), 0, '', whC, not dspN, pltS)

bC8  = S.bSC[1] == 8 and S.sSC == 1

sR   = ta.highest(9)
bSR  = 0.0
bSR := S.bSC == 9 or bC8 ? sR : b.c > bSR[1] ? 0 : bSR[1]
plot(srL and bSR > 0 ? bSR : na, "Resistance Levels", color.new(rdC, 50), 2, ptLB)
plotshape(srL and bSR > 0 and bSR != bSR[1] and str.contains(ptLT, 'Diamonds') ? bSR : na, '', shape.diamond, location.absolute, rdC, editable = dspN, size = size.tiny)

if S.bSC == 1
    S.bSL := b.l

if S.bSC > 0
    S.bSL := math.min(b.l, S.bSL)

    if b.l == S.bSL
        S.bSH := b.h

bSD  = 0.0
bSD := S.bSC == 9 ? 2 * S.bSL - S.bSH : b.c < bSD[1] or S.sSC == 9 ? 0 : bSD[1]
plot(rsB and bSD > 0 ? bSD : na, "Bullish Momentum Risk Levels", blC, 1, ptRS)

psS = (b.h >= b.h[3] and b.h >= b.h[2]) or (b.h[1] >= b.h[3] and b.h[1] >= b.h[2])

plotshape(BnoShw and not Bcmpltd and S.sSC == 1, '', shpD,  locA, noC, 0, '₁', rdC, dspN)
plotshape(BnoShw and not Bcmpltd and S.sSC == 2, '', shpD,  locA, noC, 0, '₂', rdC, dspN)
plotshape(BnoShw and not Bcmpltd and S.sSC == 3, '', shpD,  locA, noC, 0, '₃', rdC, dspN)
plotshape(BnoShw and not Bcmpltd and S.sSC == 4, '', shpD,  locA, noC, 0, '₄', rdC, dspN)
plotshape(BnoShw and not Bcmpltd and S.sSC == 5, '', shpD,  locA, noC, 0, '₅', rdC, dspN)
plotshape(BnoShw and not Bcmpltd and S.sSC == 6, '', shpD,  locA, noC, 0, '₆', rdC, dspN)
plotshape(BnoShw and not Bcmpltd and S.sSC == 7, '', shpD,  locA, noC, 0, '₇', rdC, dspN)
plotshape(BnoShw and not Bcmpltd and S.sSC == 8 and not psS, '', shpD,  locA, noC, 0, '₈', rdC, dspN)
plotshape(BnoShw and not Bcmpltd and S.sSC == 8 and     psS, '', shpD,  locA, color.new(rdC, 75), 0, 'ᵖ\n₈', whC, dspN)
//plotshape(BnoShw and not Bcmpltd and S.sSC == 9, '', shpD, locA, noC, 0, '₉', gnC, dspN)
plotshape(BnoShw and S.sSC == 9 and not psS, 'Completed Bearish Momentum Phases'  , shpD, locA, color.new(rdC, 25), 0, '' , whC, not dspN, pltS)
plotshape(BnoShw and S.sSC == 9 and     psS, 'Perfect Bearish Momentum Phases'    , shpD, locA, color.new(rdC, 25), 0, 'ᵖ', whC, not dspN, pltS)
plotshape(BnoShw and S.sSC[1] == 8 and S.bSC == 1, 'Early Bearish Momentum Phases', shpD, locA, color.new(rdC, 25), 0, '' , whC, not dspN, pltS)

sC8  = S.sSC[1] == 8 and S.bSC == 1

sS   = ta.lowest(9)
sSS  = 0.0
sSS := S.sSC == 9 or sC8 ? sS : b.c < sSS[1] ? 0 : sSS[1]
plot(srL and sSS > 0 ? sSS : na, "Support Levels", color.new(gnC, 50), 2, ptLB)
plotshape(srL and sSS > 0 and sSS != sSS[1] and str.contains(ptLT, 'Diamonds') ? sSS : na, '', shape.diamond, location.absolute, gnC, editable = dspN, size = size.tiny)

if S.sSC == 1
    S.sSH := b.h

if S.sSC > 0
    S.sSH := math.max(b.h, S.sSH)

    if b.h == S.sSH
        S.sSL := b.l

sSD  = 0.0
sSD := S.sSC == 9 ? 2 * S.sSH - S.sSL : b.c > sSD[1] or S.bSC == 9 ? 0 : sSD[1]
plot(rsB and sSD > 0 ? sSD : na, "Bearish Momentum Risk Levels", blC, 1, ptRS)

//-----------------------------------------------------------------------------}
// Trend Exhaustion Phase
//-----------------------------------------------------------------------------{

bCC = b.c <= b.l[2]
b13 = b.c <= b.l[2] and b.l >= C.bC8

var sbC = false
sbC := if S.bSC == 9 and C.bCC == 0 and (pbS or pbS[1])
    true
else
    if S.sSC == 9 or C.bCC == 13 or b.c > bSR
        false
    else
        sbC[1]

C.bCC := sbC ? S.bSC == 9 ? bCC ? 1 : 0 : bCC ? C.bCC + 1 : C.bCC : 0
C.bCC := C.bCC == 13 and b13 ? C.bCC - 1 : C.bCC

if C.bCC == 8 and C.bCC != C.bCC[1]
    C.bC8 := b.c

shwBC = noShw and not cmpltd and sbC and C.bCC != C.bCC[1]

plotshape(shwBC and C.bCC == 1 , '', shpD, locB, noC, 0, '₁' , gnC, dspN)
plotshape(shwBC and C.bCC == 2 , '', shpD, locB, noC, 0, '₂' , gnC, dspN)
plotshape(shwBC and C.bCC == 3 , '', shpD, locB, noC, 0, '₃' , gnC, dspN)
plotshape(shwBC and C.bCC == 4 , '', shpD, locB, noC, 0, '₄' , gnC, dspN)
plotshape(shwBC and C.bCC == 5 , '', shpD, locB, noC, 0, '₅' , gnC, dspN)
plotshape(shwBC and C.bCC == 6 , '', shpD, locB, noC, 0, '₆' , gnC, dspN)
plotshape(shwBC and C.bCC == 7 , '', shpD, locB, noC, 0, '₇' , gnC, dspN)
plotshape(shwBC and C.bCC == 8 , '', shpD, locB, noC, 0, '₈' , gnC, dspN)
plotshape(shwBC and C.bCC == 9 , '', shpD, locB, noC, 0, '₉' , gnC, dspN)
plotshape(shwBC and C.bCC == 10, '', shpD, locB, noC, 0, '₁₀', gnC, dspN)
plotshape(shwBC and C.bCC == 11, '', shpD, locB, noC, 0, '₁₁', gnC, dspN)
plotshape(shwBC and C.bCC == 12, '', shpD, locB, noC, 0, '₁₂', gnC, dspN)
plotshape(noShw and not cmpltd and sbC and C.bCC == C.bCC[1] and C.bCC == 12 and b13, '', shpD, locB, noC, 0, '₊', gnC, dspN)
//plotshape(shwBC and C.bCC == 13, '', shpD, locB, noC, 0, '₁₃', gnC, dspN)
plotshape(noShw and sbC and C.bCC != C.bCC[1] and C.bCC == 13, 'Completed Bullish Exhaustions', shpU, locB, color.new(#006400, 25), 0, 'E', whC, not dspN, pltS)

if C.bCC == 1
    C.bCLt := b.l
    C.bCHt := b.h
    
if sbC
    C.bCHt := math.max(b.h, C.bCHt)
    C.bCLt := math.min(b.l, C.bCLt)
    
    if b.h == C.bCHt
        C.bCL := b.l

    if b.l == C.bCLt
        C.bCH := b.h

bCT = 2 * C.bCHt - C.bCL
bCT := C.bCC == 13 ? bCT : b.c > bCT[1] or (C.bCD == 0 and C.sCC == 13) ? 0. : bCT[1]
plot(ttE and bCT > 0 ? bCT : na, "Bullish Exhaustion Target Levels", grC, 1, pltL)

bCD = 2 * C.bCLt - C.bCH
bCD := C.bCC == 13 ? bCD : b.c < bCD[1] or (bCT == 0 and C.sCC == 13) ? 0. : bCD[1]
C.bCD := bCD
plot(rsE and bCD > 0 ? bCD : na, "Bullish Exhaustion Risk Levels", bgC, 1, pltL)

sCC = b.c >= b.h[2]
s13 = b.c >= b.h[2] and b.h <= C.sC8

var ssC = false
ssC := if S.sSC == 9 and C.sCC == 0 and (psS or psS[1])
    true
else
    if S.bSC == 9 or C.sCC == 13 or b.c < sSS
        false
    else
        ssC[1]

C.sCC := ssC ? S.sSC == 9 ? sCC ? 1 : 0 : sCC ? C.sCC + 1 : C.sCC : 0
C.sCC := C.sCC == 13 and s13 ? C.sCC - 1 : C.sCC

if C.sCC == 8 and C.sCC != C.sCC[1]
    C.sC8 := b.c

shwSC = noShw and not cmpltd and ssC and C.sCC != C.sCC[1]

plotshape(shwSC and C.sCC == 1 , '', shpD, locB, noC, 0, '₁' , rdC, dspN)
plotshape(shwSC and C.sCC == 2 , '', shpD, locB, noC, 0, '₂' , rdC, dspN)
plotshape(shwSC and C.sCC == 3 , '', shpD, locB, noC, 0, '₃' , rdC, dspN)
plotshape(shwSC and C.sCC == 4 , '', shpD, locB, noC, 0, '₄' , rdC, dspN)
plotshape(shwSC and C.sCC == 5 , '', shpD, locB, noC, 0, '₅' , rdC, dspN)
plotshape(shwSC and C.sCC == 6 , '', shpD, locB, noC, 0, '₆' , rdC, dspN)
plotshape(shwSC and C.sCC == 7 , '', shpD, locB, noC, 0, '₇' , rdC, dspN)
plotshape(shwSC and C.sCC == 8 , '', shpD, locB, noC, 0, '₈' , rdC, dspN)
plotshape(shwSC and C.sCC == 9 , '', shpD, locB, noC, 0, '₉' , rdC, dspN)
plotshape(shwSC and C.sCC == 10, '', shpD, locB, noC, 0, '₁₀', rdC, dspN)
plotshape(shwSC and C.sCC == 11, '', shpD, locB, noC, 0, '₁₁', rdC, dspN)
plotshape(shwSC and C.sCC == 12, '', shpD, locB, noC, 0, '₁₂', rdC, dspN)
plotshape(noShw and not cmpltd and ssC and C.sCC == C.sCC[1] and C.sCC == 12 and s13, '', shpD, locB, noC, 0, '₊', rdC, dspN)
//plotshape(shwSC and C.sCC == 13, '', shpD, locB, noC, 0, '₁₃', rdC, dspN)
plotshape(noShw and ssC and C.sCC != C.sCC[1] and C.sCC == 13, 'Completed Bearish Exhaustions', shpD, locA, color.new(#910000, 25), 0, 'E', whC, not dspN, pltS)

if C.sCC == 1
    C.sCLt := b.l
    C.sCHt := b.h

if ssC
    C.sCHt := math.max(b.h, C.sCHt)
    C.sCLt := math.min(b.l, C.sCLt)
    
    if b.h == C.sCHt
        C.sCL := b.l

    if b.l == C.sCLt
        C.sCH := b.h

sCD = 2 * C.sCHt - C.sCL
sCD := C.sCC == 13 ? 2 * C.sCHt - C.sCL : b.c > sCD[1] or (C.sCT == 0 and C.bCC == 13) ? 0. : sCD[1]
plot(rsE and sCD > 0 ? sCD : na, "Bearish Exhaustion Risk Levels", bgC, 1, pltL)

sCT = 2 * C.sCLt - C.sCH
sCT := C.sCC == 13 ? sCT : b.c < sCT[1] or (sCD == 0 and C.bCC == 13) ? 0. : sCT[1]
C.sCT := sCT
plot(ttE and sCT > 0 ? sCT : na, "Bearish Exhaustion Target Levels", grC, 1, pltL)

//-----------------------------------------------------------------------------}
// Trade Setups
//-----------------------------------------------------------------------------{

plotshape(bSR > 0 and bSR[1] == 0 ? bSR : na, 'Overall Bearish Trend Mark', shpD, location.absolute, noC, 0, '⇩', rdC, not dspN, size = size.small, display=display.none)
plotshape(sSS > 0 and sSS[1] == 0 ? sSS : na, 'Overall Bullish Trend Mark', shpU, location.absolute, noC, 0, '⇧', gnC, not dspN, size = size.small, display=display.none)

var sbPF = false, var bPFc = false
var ssPF = false, var sPFc = false

var lTrd = false, var sTrd = false

bBl9 = ta.valuewhen(S.bSC == 9 , b.i, 0)
bBp9 = ta.valuewhen(S.bSC == 9 , b.i, 1)
bB13 = ta.valuewhen(C.bCC == 13, b.i, 0)

sBl9 = ta.valuewhen(S.sSC == 9 , b.i, 0)
sBp9 = ta.valuewhen(S.sSC == 9 , b.i, 1)
sB13 = ta.valuewhen(C.sCC == 13, b.i, 0)

trdS = tso != 'None'

sQC  = (sBl9 > sB13) and (sB13 > sBp9) and (sBp9 > bBl9)
sPFO = tso == 'Momentum' ? S.sSC == 9 or sC8 : tso == 'Exhaustion' ? C.sCC[5] == 13 : S.sSC == 9 and sQC
 
ssPF := if sPFO
    true
else
    if sPFc
        false
    else
        ssPF[1]

sPFc := ssPF and b.c < b.c[4] and b.c[1] > b.c[5]

[sTR, sST] = if tso == 'Exhaustion'
    if sCD == 0
        [' - Risky', str.tostring(b.h, format.mintick)]
    else
        ['', str.tostring(sCD, format.mintick)]
else
    if sSD == 0
        [' - Risky', str.tostring(b.h, format.mintick)]
    else
        ['', str.tostring(sSD, format.mintick)] 

sTT = 'Short Trade Setup' + sTR + '\n Signal : Completed ' + tso + ' plus Bearish Price Flip\n' +
              ' Stop    : '  + sST +
              '\n Target : ' + str.tostring(tso == 'Exhaustion' ? sCT    : sSS, format.mintick)

if sPFc and trdS
    label.new(bar_index, b.h, 'S',  xloc.bar_index, yloc.price, color.new(color.yellow, 25), label.style_label_down, color.white, size.small, text.align_center, sTT + '\n\nnot a finacial advice, subject to high risk')
    alert(syminfo.ticker + ' : ' + sTT + '\n Price    : ' + str.tostring(close, format.mintick) + '\n\nnot a finacial advice, subject to high risk')
    sTrd := true
    lTrd := false

if war and sTrd and b.o < b.c and S.sSC == 2 and not lTrd
    label.new(bar_index, b.l, '⚠️',  xloc.bar_index, yloc.price, color.new(color.yellow, 100), label.style_label_up, color.yellow, size.large, text.align_center, 'Warning\nbullish price flip detected')
    sTrd := false

if war and sTrd and b.o < b.c and ((sSD[1] != 0 and b.c > sSD[1]) or (sCD[1] != 0 and b.c > sCD[1]))
    label.new(bar_index, b.l, '⚠️',  xloc.bar_index, yloc.price, color.new(color.yellow, 100), label.style_label_up, color.yellow, size.large, text.align_center, 'Critical Warning\nstop/risk level breached')
    sTrd := false

bQC  = (bBl9 > bB13) and (bB13 > bBp9) and (bBp9 > sBl9)
bPFO = tso == 'Momentum' ? S.bSC == 9 or bC8 : tso == 'Exhaustion' ? C.bCC[5] == 13 : S.bSC == 9 and bQC 

sbPF := if bPFO
    true
else
    if bPFc
        false
    else
        sbPF[1]

bPFc := sbPF and b.c > b.c[4] and b.c[1] < b.c[5]

[bTR, bST] = if tso == 'Exhaustion'
    if bCD == 0
        [' - Risky', str.tostring(b.l, format.mintick)]
    else
        ['', str.tostring(bCD, format.mintick)]
else
    if bSD == 0
        [' - Risky', str.tostring(b.l, format.mintick)]
    else
        ['', str.tostring(bSD, format.mintick)] 

lTT = 'Long Trade Setup' + bTR + '\n Signal : Completed ' + tso + ' plus Bullish Price Flip\n' +
              ' Stop    : '  + bST +
              '\n Target : ' + str.tostring(tso == 'Exhaustion' ? bCT : bSR, format.mintick)

if bPFc and trdS
    label.new(bar_index, b.l, 'L',  xloc.bar_index, yloc.price, color.new(color.blue, 25), label.style_label_up, color.white, size.small, text.align_center, lTT + '\n\nnot a finacial advice, subject to high risk')
    alert(syminfo.ticker + ' : ' + lTT + '\n Price    : ' + str.tostring(close, format.mintick) + '\n\nnot a finacial advice, subject to high risk')
    lTrd := true
    sTrd := false

if war and lTrd and b.o > b.c and S.bSC == 2 and not sTrd
    label.new(bar_index, b.h, '⚠️',  xloc.bar_index, yloc.price, color.new(color.blue, 100), label.style_label_down, color.yellow, size.large, text.align_center, 'Warning\nbearish price flip detected')
    lTrd := false

if war and lTrd and b.o > b.c and (b.c < bSD[1] or b.c < bCD[1])
    label.new(bar_index, b.h, '⚠️',  xloc.bar_index, yloc.price, color.new(color.blue, 100), label.style_label_down, color.yellow, size.large, text.align_center, 'Critical Warning\nstop/risk level breached')
    lTrd := false

//-----------------------------------------------------------------------------}
// Alerts
//-----------------------------------------------------------------------------{

pTxt = str.tostring(b.c, format.mintick)
tTxt = syminfo.ticker

if f_xLX(b.c, bSR) and srL
    alert(tTxt + ' crossing resistance level detected, price ' + str.tostring(bSR, format.mintick))

if f_xLX(b.c, bSD) or f_xLX(b.c, sSD) and rsB
    alert(tTxt + ' crossing momentum risk level detected, price ' + str.tostring(bSD, format.mintick))

if f_xLX(b.c, sSS) and srL
    alert(tTxt + ' crossing support level detected, price ' + str.tostring(sSS, format.mintick))

if f_xLX(b.c, bCD) or f_xLX(b.c, sCD) and rsE
    alert(tTxt + ' crossing trend exhaustion risk level detected, price ' + str.tostring(bCD, format.mintick))

if S.bSC == 9 and cmpltd
    alert(tTxt + ' bullish momentum phase completion detected, price ' + pTxt)

if S.sSC == 9 and cmpltd
    alert(tTxt + ' bearish momentum phase completion detected, price ' + pTxt)

if C.bCC == 13 and cmpltd
    alert(tTxt + ' bullish trend exhaustion phase completion detected, price ' + pTxt)

if C.sCC == 13 and cmpltd
    alert(tTxt + ' bearish trend exhaustion phase completion detected, price ' + pTxt)

if bSR > 0 and bSR[1] == 0
    alert(tTxt + ' bearish momentum detected, price ' + pTxt)

if sSS > 0 and sSS[1] == 0
    alert(tTxt + ' bullish momentum detected, price ' + pTxt)

//-----------------------------------------------------------------------------}