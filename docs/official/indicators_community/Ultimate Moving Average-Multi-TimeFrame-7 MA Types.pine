//Created by user ChrisMoody 4-24-2014
//Plots The Majority of Moving Averages
//Defaults to Current Chart Time Frame --- But Can Be Changed to Higher Or Lower Time Frames
//2nd MA Capability with Show Crosses Feature
study(title="CM_Ultimate_MA_MTF", shorttitle="CM_Ultimate_MA_MTF", overlay=true)
//inputs
src = close
useCurrentRes = input(true, title="Use Current Chart Resolution?")
resCustom = input(title="Use Different Timeframe? Uncheck Box Above", type=resolution, defval="D")
len = input(20, title="Moving Average Length - LookBack Period")
atype = input(1,minval=1,maxval=7,title="1=SMA, 2=EMA, 3=WMA, 4=HullMA, 5=VWMA, 6=RMA, 7=TEMA")
cc = input(true,title="Change Color Based On Direction?")
smoothe = input(2, minval=1, maxval=10, title="Color Smoothing - 1 = No Smoothing")
doma2 = input(false, title="Optional 2nd Moving Average")
len2 = input(50, title="Moving Average Length - Optional 2nd MA")
atype2 = input(1,minval=1,maxval=7,title="1=SMA, 2=EMA, 3=WMA, 4=HullMA, 5=VWMA, 6=RMA, 7=TEMA")
cc2 = input(true,title="Change Color Based On Direction 2nd MA?")
warn = input(false, title="***You Can Turn On The Show Dots Parameter Below Without Plotting 2nd MA to See Crosses***")
warn2 = input(false, title="***If Using Cross Feature W/O Plotting 2ndMA - Make Sure 2ndMA Parameters are Set Correctly***")
sd = input(false, title="Show Dots on Cross of Both MA's")


res = useCurrentRes ? period : resCustom
//hull ma definition
hullma = wma(2*wma(src, len/2)-wma(src, len), round(sqrt(len)))
//TEMA definition
ema1 = ema(src, len)
ema2 = ema(ema1, len)
ema3 = ema(ema2, len)
tema = 3 * (ema1 - ema2) + ema3

avg = atype == 1 ? sma(src,len) : atype == 2 ? ema(src,len) : atype == 3 ? wma(src,len) : atype == 4 ? hullma : atype == 5 ? vwma(src, len) : atype == 6 ? rma(src,len) : tema
//2nd Ma - hull ma definition
hullma2 = wma(2*wma(src, len2/2)-wma(src, len2), round(sqrt(len2)))
//2nd MA TEMA definition
sema1 = ema(src, len2)
sema2 = ema(sema1, len2)
sema3 = ema(sema2, len2)
stema = 3 * (sema1 - sema2) + sema3

avg2 = atype2 == 1 ? sma(src,len2) : atype2 == 2 ? ema(src,len2) : atype2 == 3 ? wma(src,len2) : atype2 == 4 ? hullma2 : atype2 == 5 ? vwma(src, len2) : atype2 == 6 ? rma(src,len2) : tema

out = avg 
out_two = avg2

out1 = security(tickerid, res, out)
out2 = security(tickerid, res, out_two)

ma_up = out1 >= out1[smoothe]
ma_down = out1 < out1[smoothe]

col = cc ? ma_up ? lime : ma_down ? red : aqua : aqua
col2 = cc2 ? ma_up ? lime : ma_down ? red : aqua : aqua

circleYPosition = out2

plot(out1, title="Multi-Timeframe Moving Avg", style=line, linewidth=4, color = col)
plot(doma2 and out2 ? out2 : na, title="2nd Multi-TimeFrame Moving Average", style=circles, linewidth=4, color=col2)
plot(sd and cross(out1, out2) ? circleYPosition : na,style=cross, linewidth=5, color=yellow)

