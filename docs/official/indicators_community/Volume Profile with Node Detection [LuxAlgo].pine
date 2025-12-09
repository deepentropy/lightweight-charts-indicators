// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo
//@version=5

indicator("Volume Profile with Node Detection [LuxAlgo]", "LuxAlgo - Volume Profile with Node Detection", overlay = true, max_boxes_count = 500, max_bars_back = 5000)

//---------------------------------------------------------------------------------------------------------------------
// Settings
//---------------------------------------------------------------------------------------------------------------------{

display = display.all - display.status_line

vn_volumeNodesGroup = 'Volume Nodes'

vn_peakTTip = 'A volume peak node is recognized when the volume profile nodes for the N preceding and N succeeding nodes are lower than that of the evaluated one, where N is determined by the \'Node Detection Percent %\' option'
vn_peaksShow = input.string('Peaks', 'Volume Peaks', options = ['Peaks', 'Clusters', 'None'], inline = 'vnP', tooltip = vn_peakTTip, group = vn_volumeNodesGroup, display = display)
vn_peakVolumeColor = input.color(color.new(color.blue, 50), '', inline = 'vnP', group = vn_volumeNodesGroup)
vn_peaksNumberOfNodes = input.int(9, '  Node Detection Percent %', minval = 0, maxval = 100, group = vn_volumeNodesGroup, display = display) / 100
vn_peaksShow := vn_peaksNumberOfNodes == 0 ? 'None' : vn_peaksShow

vn_troughsTTip  = 'A volume trough node is recognized when the volume profile nodes for the N preceding and N succeeding nodes exceed that of the evaluated one, where N is determined by the \'Node Detection Percent %\' option'
vn_troughsShow = input.string('None', 'Volume Troughs', options = ['Troughs', 'Clusters', 'None'], inline = 'vnT', tooltip = vn_troughsTTip, group = vn_volumeNodesGroup, display = display)
vn_troughVolumeColor = input.color(color.new(color.gray, 50), '', inline = 'vnT', group = vn_volumeNodesGroup)
vn_troughsNumberOfNodes = input.int(7, '  Node Detection Percent %', minval = 0, maxval = 100, group = vn_volumeNodesGroup, display = display) / 100
vn_troughsShow := vn_troughsNumberOfNodes == 0 ? 'None' : vn_troughsShow

vn_thresholdTTip = 'A threshold value specified as a percentage is utilized to detect peak/trough volume nodes. If a value is set, the detection will disregard volume node values lower than the specified threshold.'
vn_VolumeNodeThreshold = input.int(1, 'Volume Node Threshold %', minval = 0, maxval = 100, tooltip = vn_thresholdTTip, group = vn_volumeNodesGroup, display = display) / 100

vn_highestNVolumeNodes = input.int(0, 'Highest Volume Nodes', minval = 0, maxval = 31, inline = 'vnL', group = vn_volumeNodesGroup, display = display)
vn_highestVolumeColor = input.color(color.new(color.orange, 25), '', inline = 'vnL', group = vn_volumeNodesGroup)

vn_lowestNVolumeNodes = input.int(0, 'Lowest Volume Nodes', minval = 0, maxval = 31, inline = 'vnH', group = vn_volumeNodesGroup, display = display)
vn_lowestVolumeColor = input.color(color.new(color.navy, 25), '', inline = 'vnH', group = vn_volumeNodesGroup)

vp_componentsGroup = 'Volume Profile - Components'

vp_profileShow = input.bool(true, 'Volume Profile', inline = 'vp', group = vp_componentsGroup)
vp_profileGradientColors = input.string('Gradient Colors', '', options = ['Gradient Colors', 'Classic Colors' ], inline = 'vp', group = vp_componentsGroup)
vp_valueAreaUpColor = input.color(color.new(#2962ff, 30), '  Value Area Up / Down', inline = 'VA', group = vp_componentsGroup)
vp_valueAreaDwonColor = input.color(color.new(#fbc02d, 30), '/', inline = 'VA', group = vp_componentsGroup)
vp_profileUpVolumeColor = input.color(color.new(#5d606b, 50), '  Profile Up / Down Volume', inline = 'VP', group = vp_componentsGroup)
vp_profileDownVolumeColor = input.color(color.new(#d1d4dc, 50), '/', inline = 'VP', group = vp_componentsGroup)

vp_pocShow = input.string('None', 'Point of Control', options = ['Developing', 'Regular', 'None'], inline = 'poc', group = vp_componentsGroup, display = display)
vp_pocColor = input.color(#fbc02d, '', inline = 'poc', group = vp_componentsGroup)
vp_pocWidth = input.int(2, 'Width', inline = 'poc', group = vp_componentsGroup, display = display)

vp_vahShow = input.bool(false, 'Value Area High (VAH)', inline = 'vah', group = vp_componentsGroup)
vp_vahColor = input.color(#2962ff, '', inline = 'vah', group = vp_componentsGroup)

vp_valShow = input.bool(false, 'Value Area Low (VAL)', inline = 'val', group = vp_componentsGroup)
vp_valColor = input.color(#2962ff, '', inline = 'val', group = vp_componentsGroup)

vp_profileLevels = input.string('Small', "Profile Price Labels", options=['Tiny', 'Small', 'Normal', 'None'], group = vp_componentsGroup, display = display)

vp_displayGroup = 'Volume Profile - Display Settings'

vp_profileLength = input.int(360, 'Profile Lookback Length', minval = 10, maxval = 5000, step = 10, group = vp_displayGroup, display = display)
vp_profileLength:= last_bar_index < vp_profileLength ? last_bar_index : vp_profileLength - 1

vp_valueAreaThreshold = input.float(70, 'Value Area (%)', minval = 0, maxval = 100, group = vp_displayGroup, display = display) / 100

vp_profilePlracment = input.string('Right', 'Profile Placement', options = ['Right', 'Left'], group = vp_displayGroup, display = display), profilePlacementRight = vp_profilePlracment == 'Right' 
vp_profileNumberOfRows = input.int(100, 'Profile Number of Rows' , minval = 30, maxval = 130 , step = 10, group = vp_displayGroup, display = display)
vp_profileWidth = input.float(31, 'Profile Width', minval = 0, maxval = 250, group = vp_displayGroup, display = display) / 100
vp_profileHorizontalOffset = input.int(13, 'Profile Horizontal Offset', maxval = 50, group = vp_displayGroup, display = display)

vp_valueAreaBackground = input.bool(false, 'Value Area Background  ', inline = 'vBG', group = vp_displayGroup)
vp_valueAreaBackgroundColor = input.color(color.new(#2962ff, 89), '', inline = 'vBG', group = vp_displayGroup)

vp_profileBackground = input.bool(false, 'Profile Range Background ', inline = 'pBG', group = vp_displayGroup)
vp_profileBackgroundColor  = input.color(color.new(#2962ff, 95), '', inline = 'pBG', group = vp_displayGroup)

//---------------------------------------------------------------------------------------------------------------------}
// User Defined Types
//---------------------------------------------------------------------------------------------------------------------{

type BAR
    float open   = open
    float high   = high
    float low    = low
    float close  = close
    float volume = volume
    int   index  = bar_index

type barData
    float [] barHigh
    float [] barLow
    float [] barVolume
    bool  [] barPolarity
    int   [] barCount

type volumeData
    float [] totalVolume
    float [] bullishVolume
    float [] bearishVolume
    int   [] endProfileIndex
    bool  [] peakVolume
    bool  [] troughVolume

type volumeProfile
    box         []  boxes
    chart.point []  pocPoints
    polyline        pocPolyline
    int             pocLevel
    int             vahLevel
    int             valLevel
    int             startIndex

//---------------------------------------------------------------------------------------------------------------------}
// Variables
//---------------------------------------------------------------------------------------------------------------------{

BAR bar = BAR.new()
BAR [] ltfBarData = array.new<BAR> (1, BAR.new())

var barData barDataArray = barData.new(
     array.new <float> (na), 
     array.new <float> (na), 
     array.new <float> (na), 
     array.new <bool>  (na), 
     array.new <int>   (na)
 )

volumeData volumeDataArray = volumeData.new(
     array.new <float> (vp_profileNumberOfRows, 0.), 
     array.new <float> (vp_profileNumberOfRows, 0.), 
     array.new <float> (vp_profileNumberOfRows, 0.),
     array.new <int>   (vp_profileNumberOfRows, 0 ),
     array.new <bool>  (vp_profileNumberOfRows, 0.),
     array.new <bool>  (vp_profileNumberOfRows, 0.)
 )

var volumeProfile VP = volumeProfile.new(
     array.new<box>         (na),
     array.new<chart.point> (na),
     polyline.new           (na), na, na, na, na
 )

var float highestPrice = na
var float lowestPrice = na

//---------------------------------------------------------------------------------------------------------------------}
// Functions / Methods
//---------------------------------------------------------------------------------------------------------------------{

renderLine(_x1, _y1, _x2, _y2, _xloc, _extend, _color, _style, _width) =>
    var id = line.new(_x1, _y1, _x2, _y2, _xloc, _extend, _color, _style, _width)
    line.set_xy1(id, _x1, _y1)
    line.set_xy2(id, _x2, _y2)
    line.set_color(id, _color)

renderLabel(_x, _y, _text, _color, _style, _textcolor, _size, _tooltip) =>
    var lb = label.new(_x, _y, _text, xloc.bar_index, yloc.price, _color, _style, _textcolor, _size, text.align_left, _tooltip)
    lb.set_xy(_x, _y)
    lb.set_text(_text)
    lb.set_tooltip(_tooltip)
    lb.set_textcolor(_textcolor)

requestBarData(_lowerTimeframe) => request.security_lower_tf(syminfo.tickerid, _lowerTimeframe, BAR.new(), ignore_invalid_timeframe = true)

calculateTimeframe(_depth) => 
    int tfInMs = timeframe.in_seconds(timeframe.period)
    int  mInMS = 60

    if _depth == 2
        switch
            tfInMs <                 30  =>  '1S'
            tfInMs <          1 * mInMS  =>  '5S'

            tfInMs <=        15 * mInMS  =>   '1'
            tfInMs <=        60 * mInMS  =>   '5'
            tfInMs <=       240 * mInMS  =>  '15'
            tfInMs <=      1440 * mInMS  =>  '60'
            => 'D'

    else if _depth == 1
        switch
            tfInMs <                 15  =>  '1S'
            tfInMs <                 30  =>  '5S'
            tfInMs <          1 * mInMS  => '15S'

            tfInMs <=         5 * mInMS  =>   '1'
            tfInMs <=        15 * mInMS  =>   '5'
            tfInMs <=        60 * mInMS  =>  '15'
            tfInMs <=       240 * mInMS  =>  '60'
            tfInMs <=      1440 * mInMS  => '240'
            => 'D'

getTextSize(_text) =>
    if _text != 'None'
        switch _text
            'Tiny'   => size.tiny
            'Small'  => size.small 
            'Normal' => size.normal
            => size.auto

//---------------------------------------------------------------------------------------------------------------------}
// Calculations - Volume Profile
//---------------------------------------------------------------------------------------------------------------------{

profileLevesSize  = getTextSize(vp_profileLevels)

if bar.index == last_bar_index - vp_profileLength
    VP.startIndex := bar.index
    lowestPrice := bar.low 
    highestPrice := bar.high
else if bar.index > last_bar_index - vp_profileLength
    lowestPrice := math.min(bar.low, lowestPrice)
    highestPrice := math.max(bar.high, highestPrice)

//if vp_profileLength <= 200
//    ltfBarData := requestBarData(calculateTimeframe(2))  
//else 
if vp_profileLength <= 700
    ltfBarData := requestBarData(calculateTimeframe(2)) 
else
    ltfBarData := array.new<BAR> (1, BAR.new(bar.open, bar.high, bar.low, bar.close, bar.volume))

if barstate.ishistory and (bar.index >= last_bar_index - vp_profileLength) and bar.index < last_bar_index and ltfBarData.size() > 0

    log.info("yaz_kizim {0} {1}", ltfBarData.get(0).volume, na(nz(ltfBarData.get(0).volume)) )

    if ltfBarData.size() > 0 and not na(nz(ltfBarData.get(0).volume))
        for currentLtfBar = 0 to ltfBarData.size() - 1
            barDataArray.barHigh.push(ltfBarData.get(currentLtfBar).high)
            barDataArray.barLow.push(ltfBarData.get(currentLtfBar).low)
            barDataArray.barVolume.push(ltfBarData.get(currentLtfBar).volume)
            barDataArray.barPolarity.push(ltfBarData.get(currentLtfBar).close > ltfBarData.get(currentLtfBar).open)

        barDataArray.barCount.push(ltfBarData.size())

priceStep = (highestPrice - lowestPrice) / vp_profileNumberOfRows

if barstate.islast and ltfBarData.size() > 0 //  barDataArray.barVolume.size() > 0 //

    if VP.boxes.size() > 0
        for boxIndex = 0 to VP.boxes.size() - 1
            box.delete(VP.boxes.shift())

    if barDataArray.barCount.size() > vp_profileLength
        barCount = barDataArray.barCount.shift()
        for barCountIndex = 0 to barCount - 1
            barDataArray.barHigh.shift()
            barDataArray.barLow.shift()
            barDataArray.barVolume.shift()
            barDataArray.barPolarity.shift()

    VP.pocPoints.clear()
    VP.pocPolyline.delete()

    if ltfBarData.size() > 0 and not na(nz(ltfBarData.get(0).volume))
        for currentLtfBar = 0 to ltfBarData.size() - 1
            barDataArray.barHigh.push(ltfBarData.get(currentLtfBar).high)
            barDataArray.barLow.push(ltfBarData.get(currentLtfBar).low)
            barDataArray.barVolume.push(ltfBarData.get(currentLtfBar).volume)
            barDataArray.barPolarity.push(ltfBarData.get(currentLtfBar).close > ltfBarData.get(currentLtfBar).open)

        barDataArray.barCount.push(ltfBarData.size())

    barIndex = vp_profileLength
    numberOfBars = 0
    arraySize = barDataArray.barVolume.size()

    for arrayIndex = 0 to arraySize - 1

        levelHigh = barDataArray.barHigh.get(arrayIndex)
        levelLow = barDataArray.barLow.get(arrayIndex)
        levelVolume = barDataArray.barVolume.get(arrayIndex)

        // Shoutout to @tkarolak for contributing to the code's optimization! Much appreciated.
        
        int startSlotIndex = math.max(math.floor((levelLow - lowestPrice) / priceStep), 0)
        int endSlotIndex = math.min(math.floor((levelHigh - lowestPrice) / priceStep), vp_profileNumberOfRows - 1)
        
        for priceLevelIndex = startSlotIndex to endSlotIndex

            float priceLevel = lowestPrice + priceLevelIndex * priceStep

            volumeProportion = switch
                levelLow >= priceLevel and levelHigh > priceLevel + priceStep => (priceLevel + priceStep - levelLow) / (levelHigh - levelLow)
                levelHigh <= priceLevel + priceStep and levelLow < priceLevel => (levelHigh - priceLevel) / (levelHigh - levelLow)
                levelLow >= priceLevel and levelHigh <= priceLevel + priceStep => 1
                => priceStep / (levelHigh - levelLow)

            volumeDataArray.totalVolume.set(priceLevelIndex, volumeDataArray.totalVolume.get(priceLevelIndex) + levelVolume * volumeProportion)

            if barDataArray.barPolarity.get(arrayIndex)
                volumeDataArray.bullishVolume.set(priceLevelIndex, volumeDataArray.bullishVolume.get(priceLevelIndex) + levelVolume * volumeProportion)

//        priceLevelIndex = 0
//        for priceLevel = lowestPrice to highestPrice - priceStep by priceStep
//
//            if levelHigh >= priceLevel and levelLow < priceLevel + priceStep
//
//                volumeProportion = if levelLow >= priceLevel and levelHigh > priceLevel + priceStep
//                    (priceLevel + priceStep - levelLow) / (levelHigh - levelLow)
//                else if levelHigh <= priceLevel + priceStep and levelLow < priceLevel
//                    (levelHigh - priceLevel) / (levelHigh - levelLow)
//                else if levelLow >= priceLevel and levelHigh <= priceLevel + priceStep
//                    1
//                else
//                    priceStep / (levelHigh - levelLow)
//
//                volumeDataArray.totalVolume.set(priceLevelIndex, volumeDataArray.totalVolume.get(priceLevelIndex) + levelVolume * volumeProportion)
//
//                if barDataArray.barPolarity.get(arrayIndex)
//                    volumeDataArray.bullishVolume.set(priceLevelIndex, volumeDataArray.bullishVolume.get(priceLevelIndex) + levelVolume * volumeProportion)
//            priceLevelIndex += 1

        if vp_pocShow == 'Developing'
            if arrayIndex == barDataArray.barCount.get(vp_profileLength - barIndex)
                VP.pocPoints.push(chart.point.from_index(bar.index[barIndex], math.avg(bar.high[barIndex], bar.low[barIndex])))
                VP.pocPoints.push(chart.point.from_index(bar.index[barIndex] + 1, lowestPrice + (volumeDataArray.totalVolume.indexof(volumeDataArray.totalVolume.max()) + .5) * priceStep))
                numberOfBars += barDataArray.barCount.get(vp_profileLength - barIndex)
                barIndex  -= 1
            else if arrayIndex == (numberOfBars + barDataArray.barCount.get(vp_profileLength - barIndex)) and numberOfBars != 0
                VP.pocPoints.push(chart.point.from_index(bar.index[barIndex] + 1, lowestPrice + (volumeDataArray.totalVolume.indexof(volumeDataArray.totalVolume.max()) + .5) * priceStep))
                numberOfBars += barDataArray.barCount.get(vp_profileLength - barIndex)
                barIndex  -= 1
            else if barIndex == 0
                VP.pocPoints.push(chart.point.from_index(bar.index[barIndex] + 1, lowestPrice + (volumeDataArray.totalVolume.indexof(volumeDataArray.totalVolume.max()) + .5) * priceStep))
                numberOfBars += barDataArray.barCount.get(vp_profileLength - barIndex)

    VP.pocPolyline := polyline.new(VP.pocPoints, false, false, xloc.bar_index, vp_pocColor, color(na), line.style_solid, vp_pocWidth)

    for volumeIndex = 0 to vp_profileNumberOfRows - 1
        bearishVolume = 2 * volumeDataArray.bullishVolume.get(volumeIndex) - volumeDataArray.totalVolume.get(volumeIndex)
        volumeDataArray.bearishVolume.set(volumeIndex, volumeDataArray.bearishVolume.get(volumeIndex) + bearishVolume * (bearishVolume > 0 ? 1 : -1) )

    VP.pocLevel := volumeDataArray.totalVolume.indexof(volumeDataArray.totalVolume.max())
    totalTradedVolume = volumeDataArray.totalVolume.sum() * vp_valueAreaThreshold
    valueAreaVolume = VP.pocLevel != -1 ? volumeDataArray.totalVolume.get(VP.pocLevel) : 0
    VP.vahLevel := VP.pocLevel
    VP.valLevel := VP.pocLevel
    
    while valueAreaVolume < totalTradedVolume
        if VP.valLevel == 0 and VP.vahLevel == vp_profileNumberOfRows - 1
            break

        volumeAbovePOC = 0.
        if VP.vahLevel < vp_profileNumberOfRows - 1 
            volumeAbovePOC := volumeDataArray.totalVolume.get(VP.vahLevel + 1)

        volumeBelowPOC = 0.
        if VP.valLevel > 0
            volumeBelowPOC := volumeDataArray.totalVolume.get(VP.valLevel - 1)
        
        if volumeBelowPOC == 0 and volumeAbovePOC == 0
            break

        if volumeAbovePOC >= volumeBelowPOC
            valueAreaVolume  += volumeAbovePOC
            VP.vahLevel += 1
        else
            valueAreaVolume  += volumeBelowPOC
            VP.valLevel -= 1

    vahPrice = lowestPrice + (VP.vahLevel + 1.) * priceStep
    pocPrice = lowestPrice + (VP.pocLevel + .5) * priceStep
    valPrice = lowestPrice + (VP.valLevel + .0) * priceStep

    profilePlottingLength = vp_profileLength > 360 ? 360 : vp_profileLength
    profileWidth = profilePlottingLength * vp_profileWidth
    profileHorizontalOffset = int(profileWidth + vp_profileHorizontalOffset)

    if vp_profileShow and profilePlacementRight and vp_pocShow == 'Developing'
        renderLine(last_bar_index, pocPrice, profileHorizontalOffset + int(last_bar_index - profileWidth + 1), pocPrice, xloc.bar_index, extend.none, vp_pocColor, line.style_solid, vp_pocWidth)

    if vp_vahShow
        renderLine(VP.startIndex, vahPrice, 
                   profilePlacementRight ? (vp_profileShow ? profileHorizontalOffset : 0) + last_bar_index : last_bar_index, 
                   vahPrice, xloc.bar_index, extend.none, vp_vahColor, line.style_solid, 1)
    
    if vp_pocShow == 'Regular'
        renderLine(VP.startIndex, pocPrice, profilePlacementRight ? vp_profileShow ? profileHorizontalOffset + int(last_bar_index - profileWidth + 1) : last_bar_index : last_bar_index, pocPrice, xloc.bar_index, extend.none, vp_pocColor, line.style_solid, vp_pocWidth)

    if vp_valShow
        renderLine(VP.startIndex, valPrice, 
                   profilePlacementRight ? (vp_profileShow ? profileHorizontalOffset : 0) + last_bar_index : last_bar_index, 
                   valPrice, xloc.bar_index, extend.none, vp_valColor, line.style_solid, 1)

    if vp_valueAreaBackground
        VP.boxes.push(box.new(VP.startIndex, valPrice, last_bar_index, vahPrice, vp_valueAreaBackgroundColor, 1, line.style_dotted, bgcolor = vp_valueAreaBackgroundColor))

    if vp_profileBackground
        VP.boxes.push(box.new(VP.startIndex, lowestPrice, last_bar_index, highestPrice, vp_profileBackgroundColor, 1, line.style_dotted, bgcolor = vp_profileBackgroundColor))

    if vp_profileLevels != 'None' and VP.pocLevel != -1 
        renderLabel(profilePlacementRight ? (vp_profileShow ? profileHorizontalOffset : 0) + last_bar_index : vp_profileShow ? VP.startIndex : last_bar_index, 
                     highestPrice, str.tostring(highestPrice, format.mintick), color.new(chart.fg_color, 89), label.style_label_down, chart.fg_color, profileLevesSize, 'Profile High')

        renderLabel(profilePlacementRight ? (vp_profileShow ? profileHorizontalOffset : 0) + last_bar_index : last_bar_index, 
                     vahPrice, str.tostring(vahPrice, format.mintick), color.new(vp_vahColor, 89), label.style_label_left, vp_vahColor, profileLevesSize, 'Value Area High')

        renderLabel(profilePlacementRight ? (vp_profileShow ? profileHorizontalOffset : 0) + last_bar_index : last_bar_index, 
                     pocPrice, str.tostring(pocPrice, format.mintick), color.new(vp_pocColor, 89), label.style_label_left, vp_pocColor, profileLevesSize, 'Point of Control')
 
        renderLabel(profilePlacementRight ? (vp_profileShow ? profileHorizontalOffset : 0) + last_bar_index : last_bar_index, 
                     valPrice, str.tostring(valPrice, format.mintick), color.new(vp_valColor, 89), label.style_label_left, vp_valColor, profileLevesSize, 'Value Area Low')

        renderLabel(profilePlacementRight ? (vp_profileShow ? profileHorizontalOffset : 0) + last_bar_index : vp_profileShow ? VP.startIndex : last_bar_index, 
                     lowestPrice, str.tostring(lowestPrice, format.mintick), color.new(chart.fg_color, 89), label.style_label_up, chart.fg_color, profileLevesSize, 'Profile Low')

    for volumeNodeLevel = 0 to vp_profileNumberOfRows - 1
    
        if vp_profileShow
            if vp_profileGradientColors == 'Gradient Colors'
                vp_valueAreaUpColor       := color.from_gradient(volumeDataArray.totalVolume.get(volumeNodeLevel) / volumeDataArray.totalVolume.max(), 0, 1, color.new(vp_valueAreaUpColor      , 95), color.new(vp_valueAreaUpColor      , 0))  
                vp_valueAreaDwonColor     := color.from_gradient(volumeDataArray.totalVolume.get(volumeNodeLevel) / volumeDataArray.totalVolume.max(), 0, 1, color.new(vp_valueAreaDwonColor    , 95), color.new(vp_valueAreaDwonColor    , 0))  
                vp_profileUpVolumeColor   := color.from_gradient(volumeDataArray.totalVolume.get(volumeNodeLevel) / volumeDataArray.totalVolume.max(), 0, 1, color.new(vp_profileUpVolumeColor  , 95), color.new(vp_profileUpVolumeColor  , 0))  
                vp_profileDownVolumeColor := color.from_gradient(volumeDataArray.totalVolume.get(volumeNodeLevel) / volumeDataArray.totalVolume.max(), 0, 1, color.new(vp_profileDownVolumeColor, 95), color.new(vp_profileDownVolumeColor, 0))  
 
            startProfileIndex = profilePlacementRight ? 
                                 profileHorizontalOffset + int(last_bar_index - volumeDataArray.bullishVolume.get(volumeNodeLevel) / volumeDataArray.totalVolume.max() * profileWidth) :
                                 VP.startIndex
            endProfileIndex   = profilePlacementRight ? 
                                 profileHorizontalOffset + last_bar_index : 
                                 int(startProfileIndex + volumeDataArray.bullishVolume.get(volumeNodeLevel) / volumeDataArray.totalVolume.max() * profileWidth)

            VP.boxes.push(box.new(startProfileIndex, lowestPrice + (volumeNodeLevel + .1) * priceStep, endProfileIndex, lowestPrice + (volumeNodeLevel + .9) * priceStep, 
                                   color(na), bgcolor = volumeNodeLevel >= VP.valLevel and volumeNodeLevel <= VP.vahLevel ? vp_valueAreaUpColor : vp_profileUpVolumeColor))

            startProfileIndex := profilePlacementRight ? startProfileIndex : endProfileIndex
            endProfileIndex   := profilePlacementRight ? 
                                 startProfileIndex - int( (volumeDataArray.totalVolume.get(volumeNodeLevel) - volumeDataArray.bullishVolume.get(volumeNodeLevel)) / volumeDataArray.totalVolume.max() * profileWidth) : 
                                 startProfileIndex + int( (volumeDataArray.totalVolume.get(volumeNodeLevel) - volumeDataArray.bullishVolume.get(volumeNodeLevel)) / volumeDataArray.totalVolume.max() * profileWidth)

            VP.boxes.push(box.new(startProfileIndex, lowestPrice + (volumeNodeLevel + .1) * priceStep, endProfileIndex, lowestPrice + (volumeNodeLevel + .9) * priceStep, 
                                   color(na), bgcolor = volumeNodeLevel >= VP.valLevel and volumeNodeLevel <= VP.vahLevel ? vp_valueAreaDwonColor : vp_profileDownVolumeColor))
            volumeDataArray.endProfileIndex.set(volumeNodeLevel, endProfileIndex)

    if  vn_peaksShow != 'None' or  vn_troughsShow != 'None'
        var int startVolumeNodeIndex = na, var int endVolumeNodeIndex = na
        var bool peakUpperNth = na, var bool peakLowerNth = na

        peaksNumberOfNodes = int(vp_profileNumberOfRows * vn_peaksNumberOfNodes)

        tempPeakTotalVolume = volumeDataArray.totalVolume.copy()

        for index = 1 to peaksNumberOfNodes
            tempPeakTotalVolume.unshift(0.)
            tempPeakTotalVolume.push(0.)

        for volumeNodeLevel = 0 to vp_profileNumberOfRows - 1 + 2 * peaksNumberOfNodes 

            if vn_peaksShow != 'None' and volumeNodeLevel >= 2 * peaksNumberOfNodes 

                for currentVolumeNode = volumeNodeLevel - 2 * peaksNumberOfNodes to volumeNodeLevel - peaksNumberOfNodes - 1
                    if tempPeakTotalVolume.get(volumeNodeLevel - peaksNumberOfNodes) <= tempPeakTotalVolume.get(currentVolumeNode)
                        peakUpperNth := false
                        break
                    else
                        peakUpperNth := true

                for currentVolumeNode = volumeNodeLevel - peaksNumberOfNodes + 1 to volumeNodeLevel
                    if tempPeakTotalVolume.get(volumeNodeLevel - peaksNumberOfNodes) <= tempPeakTotalVolume.get(currentVolumeNode)
                        peakLowerNth := false
                        break
                    else
                        peakLowerNth := true

                if peakUpperNth and peakLowerNth and tempPeakTotalVolume.get(volumeNodeLevel - peaksNumberOfNodes) / tempPeakTotalVolume.max() > vn_VolumeNodeThreshold

                    startVolumeNodeIndex := vp_profileShow ? profilePlacementRight ? 
                                                             VP.startIndex : 
                                                             volumeDataArray.endProfileIndex.get(volumeNodeLevel - 2 * peaksNumberOfNodes) : //VP.startIndex + int(volumeDataArray.totalVolume.get(volumeNodeLevel - vn_peaksNumberOfNodes) / volumeDataArray.totalVolume.max() * profileWidth) : 
                                             VP.startIndex

                    endVolumeNodeIndex   := vp_profileShow ? profilePlacementRight ? 
                                                             volumeDataArray.endProfileIndex.get(volumeNodeLevel - 2 * peaksNumberOfNodes) : //profileHorizontalOffset + int(last_bar_index - volumeDataArray.totalVolume.get(volumeNodeLevel - vn_peaksNumberOfNodes) / volumeDataArray.totalVolume.max() * profileWidth) : 
                                                             last_bar_index : 
                                             last_bar_index

                    vn_peakVolumeColor := vn_peaksShow == 'Peaks' ? vn_peakVolumeColor : color.from_gradient(tempPeakTotalVolume.get(volumeNodeLevel - peaksNumberOfNodes) / tempPeakTotalVolume.max(), 0, 1, color.new(vn_peakVolumeColor, 95), color.new(vn_peakVolumeColor, 65))  

                    VP.boxes.push(box.new(startVolumeNodeIndex, lowestPrice + (volumeNodeLevel - 2 * peaksNumberOfNodes + .1) * priceStep, endVolumeNodeIndex, lowestPrice + (volumeNodeLevel - 2 * peaksNumberOfNodes + .9) * priceStep, 
                                          color(na), bgcolor = vn_peakVolumeColor))

                    if vn_peaksShow == 'Clusters'

                        for currentVolumeNode = volumeNodeLevel - 2 * peaksNumberOfNodes to volumeNodeLevel

                            if currentVolumeNode >= peaksNumberOfNodes and currentVolumeNode <= vp_profileNumberOfRows - 1 + peaksNumberOfNodes
                                if not volumeDataArray.peakVolume.get(currentVolumeNode - peaksNumberOfNodes)

                                    startVolumeNodeIndex := vp_profileShow ? profilePlacementRight ? 
                                                                         VP.startIndex : 
                                                                         volumeDataArray.endProfileIndex.get(currentVolumeNode - peaksNumberOfNodes) : //VP.startIndex + int(volumeDataArray.totalVolume.get(currentVolumeNode) / volumeDataArray.totalVolume.max() * profileWidth) : 
                                                         VP.startIndex

                                    endVolumeNodeIndex   := vp_profileShow ? profilePlacementRight ? 
                                                                         volumeDataArray.endProfileIndex.get(currentVolumeNode - peaksNumberOfNodes) : //profileHorizontalOffset + int(last_bar_index - volumeDataArray.totalVolume.get(currentVolumeNode) / volumeDataArray.totalVolume.max() * profileWidth) : 
                                                                         last_bar_index : 
                                                         last_bar_index

                                    VP.boxes.push(box.new(startVolumeNodeIndex, lowestPrice + (currentVolumeNode - peaksNumberOfNodes + .0) * priceStep, endVolumeNodeIndex, lowestPrice + (currentVolumeNode - peaksNumberOfNodes + 1.) * priceStep, 
                                                       color(na), bgcolor = vn_peakVolumeColor))
                                    volumeDataArray.peakVolume.set(currentVolumeNode - peaksNumberOfNodes, true)

        tempPeakTotalVolume.clear()

        var bool troughUpperNth = na, var bool troughLowerNth = na
        troughsNumberOfNodes = int(vp_profileNumberOfRows * vn_troughsNumberOfNodes)

        tempTroughTotalVolume = volumeDataArray.totalVolume.copy()

        for index = 1 to troughsNumberOfNodes
            tempTroughTotalVolume.unshift(volumeDataArray.totalVolume.max())
            tempTroughTotalVolume.push(volumeDataArray.totalVolume.max())
            
        for volumeNodeLevel = 0 to vp_profileNumberOfRows - 1 + 2 * troughsNumberOfNodes 

            if vn_troughsShow != 'None' and volumeNodeLevel >= 2 * troughsNumberOfNodes 

                for currentVolumeNode = volumeNodeLevel - 2 * troughsNumberOfNodes to volumeNodeLevel - troughsNumberOfNodes - 1
                    if tempTroughTotalVolume.get(volumeNodeLevel - troughsNumberOfNodes) >= tempTroughTotalVolume.get(currentVolumeNode)
                        troughUpperNth := false
                        break
                    else
                        troughUpperNth := true

                for currentVolumeNode = volumeNodeLevel - troughsNumberOfNodes + 1 to volumeNodeLevel
                    if tempTroughTotalVolume.get(volumeNodeLevel - troughsNumberOfNodes) >= tempTroughTotalVolume.get(currentVolumeNode)
                        troughLowerNth := false
                        break
                    else
                        troughLowerNth := true

                if troughUpperNth and troughLowerNth and tempTroughTotalVolume.get(volumeNodeLevel - troughsNumberOfNodes) / tempTroughTotalVolume.max() > vn_VolumeNodeThreshold

                    startVolumeNodeIndex := vp_profileShow ? profilePlacementRight ? 
                                                             VP.startIndex : 
                                                             volumeDataArray.endProfileIndex.get(volumeNodeLevel - 2 * troughsNumberOfNodes) : //VP.startIndex + int(volumeDataArray.totalVolume.get(volumeNodeLevel - vn_troughsNumberOfNodes) / volumeDataArray.totalVolume.max() * profileWidth) : 
                                             VP.startIndex

                    endVolumeNodeIndex   := vp_profileShow ? profilePlacementRight ? 
                                                             volumeDataArray.endProfileIndex.get(volumeNodeLevel - 2 * troughsNumberOfNodes) : //profileHorizontalOffset + int(last_bar_index - volumeDataArray.totalVolume.get(volumeNodeLevel - vn_troughsNumberOfNodes) / volumeDataArray.totalVolume.max() * profileWidth) : 
                                                             last_bar_index : 
                                             last_bar_index

                    vn_troughVolumeColor := vn_troughsShow == 'Troughs' ? vn_troughVolumeColor : color.from_gradient(tempTroughTotalVolume.get(volumeNodeLevel - troughsNumberOfNodes) / tempTroughTotalVolume.max(), 0, 1, color.new(vn_troughVolumeColor, 95), color.new(vn_troughVolumeColor, 31))  

                    VP.boxes.push(box.new(startVolumeNodeIndex, lowestPrice + (volumeNodeLevel - 2 * troughsNumberOfNodes + .1) * priceStep, endVolumeNodeIndex, lowestPrice + (volumeNodeLevel - 2 * troughsNumberOfNodes + .9) * priceStep, 
                                          color(na), bgcolor = vn_troughVolumeColor))


                    if vn_troughsShow == 'Clusters'

                        for currentVolumeNode = volumeNodeLevel - 2 * troughsNumberOfNodes to volumeNodeLevel

                            if currentVolumeNode >= troughsNumberOfNodes and currentVolumeNode <= vp_profileNumberOfRows - 1 + troughsNumberOfNodes

                                if not volumeDataArray.troughVolume.get(currentVolumeNode - troughsNumberOfNodes)
                                    startVolumeNodeIndex := vp_profileShow ? profilePlacementRight ? 
                                                                         VP.startIndex : 
                                                                         volumeDataArray.endProfileIndex.get(currentVolumeNode - troughsNumberOfNodes) : //VP.startIndex + int(volumeDataArray.totalVolume.get(currentVolumeNode) / volumeDataArray.totalVolume.max() * profileWidth) : 
                                                         VP.startIndex

                                    endVolumeNodeIndex   := vp_profileShow ? profilePlacementRight ? 
                                                                         volumeDataArray.endProfileIndex.get(currentVolumeNode - troughsNumberOfNodes) : //profileHorizontalOffset + int(last_bar_index - volumeDataArray.totalVolume.get(currentVolumeNode) / volumeDataArray.totalVolume.max() * profileWidth) : 
                                                                         last_bar_index : 
                                                         last_bar_index

                                    VP.boxes.push(box.new(startVolumeNodeIndex, lowestPrice + (currentVolumeNode - troughsNumberOfNodes + .0) * priceStep, endVolumeNodeIndex, lowestPrice + (currentVolumeNode - troughsNumberOfNodes + 1.) * priceStep, 
                                                      color(na), bgcolor = vn_troughVolumeColor))
                                    volumeDataArray.troughVolume.set(currentVolumeNode - troughsNumberOfNodes, true)

        tempTroughTotalVolume.clear()

    if vn_highestNVolumeNodes > 0
        for highestNode = 0 to vn_highestNVolumeNodes - 1
            startVolumeNodeIndex = vp_profileShow ? profilePlacementRight ? 
                                                     VP.startIndex : 
                                                     volumeDataArray.endProfileIndex.get(volumeDataArray.totalVolume.indexof(volumeDataArray.totalVolume.max(highestNode))) : //VP.startIndex + int(volumeDataArray.totalVolume.get(volumeDataArray.totalVolume.indexof(volumeDataArray.totalVolume.max(highestNode))) / volumeDataArray.totalVolume.max() * profileWidth) : 
                                     VP.startIndex
            endVolumeNodeIndex   = vp_profileShow ? profilePlacementRight ? 
                                                     volumeDataArray.endProfileIndex.get(volumeDataArray.totalVolume.indexof(volumeDataArray.totalVolume.max(highestNode))) : //profileHorizontalOffset + int(last_bar_index - volumeDataArray.totalVolume.get(volumeDataArray.totalVolume.indexof(volumeDataArray.totalVolume.max(highestNode))) / volumeDataArray.totalVolume.max() * profileWidth) : 
                                                     last_bar_index : 
                                     last_bar_index

            VP.boxes.push(box.new(startVolumeNodeIndex, lowestPrice + (volumeDataArray.totalVolume.indexof(volumeDataArray.totalVolume.max(highestNode)) + .1) * priceStep, endVolumeNodeIndex, lowestPrice + (volumeDataArray.totalVolume.indexof(volumeDataArray.totalVolume.max(highestNode)) + .9) * priceStep, color(na), bgcolor = vn_highestVolumeColor))

    if vn_lowestNVolumeNodes > 0

        lowestNVolumeNodeCount = 0
        lowestNVolumeNodeIndex = 0//volumeDataArray.totalVolume.indexof(volumeDataArray.totalVolume.min())
        lowestNVolumeNodeValue = 0.

        while lowestNVolumeNodeCount < vn_lowestNVolumeNodes

            if lowestNVolumeNodeIndex == vp_profileNumberOfRows
                break

            if volumeDataArray.totalVolume.min(lowestNVolumeNodeIndex) != lowestNVolumeNodeValue
                lowestNVolumeNodeValue := volumeDataArray.totalVolume.min(lowestNVolumeNodeIndex)

                startVolumeNodeIndex = vp_profileShow ? profilePlacementRight ? 
                                                     VP.startIndex : 
                                                     volumeDataArray.endProfileIndex.get(volumeDataArray.totalVolume.indexof(volumeDataArray.totalVolume.min(lowestNVolumeNodeIndex))) : //VP.startIndex + int(volumeDataArray.totalVolume.get(volumeDataArray.totalVolume.indexof(volumeDataArray.totalVolume.min(lowestNVolumeNodeIndex))) / volumeDataArray.totalVolume.max() * profileWidth) : 
                                     VP.startIndex

                endVolumeNodeIndex   = vp_profileShow ? profilePlacementRight ? 
                                                     volumeDataArray.endProfileIndex.get(volumeDataArray.totalVolume.indexof(volumeDataArray.totalVolume.min(lowestNVolumeNodeIndex))) : //profileHorizontalOffset + int(last_bar_index - volumeDataArray.totalVolume.get(volumeDataArray.totalVolume.indexof(volumeDataArray.totalVolume.min(lowestNVolumeNodeIndex))) / volumeDataArray.totalVolume.max() * profileWidth) : 
                                                     last_bar_index : 
                                     last_bar_index

                VP.boxes.push(box.new(startVolumeNodeIndex, lowestPrice + (volumeDataArray.totalVolume.indexof(volumeDataArray.totalVolume.min(lowestNVolumeNodeIndex)) + .1) * priceStep, endVolumeNodeIndex, lowestPrice + (volumeDataArray.totalVolume.indexof(volumeDataArray.totalVolume.min(lowestNVolumeNodeIndex)) + .9) * priceStep, color(na), bgcolor = vn_lowestVolumeColor))
                lowestNVolumeNodeCount += 1
            lowestNVolumeNodeIndex += 1

    log.info("yaz_kizim {0} {1}", VP.boxes.size(), volumeDataArray.totalVolume.size() )

//---------------------------------------------------------------------------------------------------------------------}