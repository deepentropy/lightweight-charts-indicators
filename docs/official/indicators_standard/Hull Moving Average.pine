//@version=6
indicator(title="Hull Moving Average", shorttitle="HMA", overlay=true, timeframe="", timeframe_gaps=true)
length = input.int(9, "Length", minval = 2)
src    = input(close, "Source")
hullma = ta.wma(2*ta.wma(src, length/2)-ta.wma(src, length), math.floor(math.sqrt(length)))
plot(hullma, "HMA")