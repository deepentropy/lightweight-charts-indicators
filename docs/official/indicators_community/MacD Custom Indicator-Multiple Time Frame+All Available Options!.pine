//Created by user ChrisMoody updated 4-10-2014
//Regular MACD Indicator with Histogram that plots 4 Colors Based on Direction Above and Below the Zero Line
//Update allows Check Box Options, Show MacD & Signal Line, Show Change In color of MacD Line based on cross of Signal Line.
//Show Dots at Cross of MacD and Signal Line, Histogram can show 4 colors or 1, Turn on and off Histogram.
//Special Thanks to that incredible person in Tech Support whoem I won't say you r name so you don't get bombarded with emails
//Note the feature Tech Support showed me on how to set the default timeframe of the indicator to the chart Timeframe, but also allow you to choose a different timeframe.
//By the way I fully disclose that I completely STOLE the Dots at the MAcd Cross from "TheLark"

study(title="CM_MacD_Ult_MTF", shorttitle="CM_Ult_MacD_MTF")
source = close
useCurrentRes = input(true, title="Use Current Chart Resolution?")
resCustom = input(title="Use Different Timeframe? Uncheck Box Above", type=resolution, defval="60")
smd = input(true, title="Show MacD & Signal Line? Also Turn Off Dots Below")
sd = input(true, title="Show Dots When MacD Crosses Signal Line?")
sh = input(true, title="Show Histogram?")
macd_colorChange = input(true,title="Change MacD Line Color-Signal Line Cross?")
hist_colorChange = input(true,title="MacD Histogram 4 Colors?")

res = useCurrentRes ? period : resCustom

fastLength = input(12, minval=1), slowLength=input(26,minval=1)
signalLength=input(9,minval=1)

fastMA = ema(source, fastLength)
slowMA = ema(source, slowLength)

macd = fastMA - slowMA
signal = sma(macd, signalLength)
hist = macd - signal

outMacD = security(tickerid, res, macd)
outSignal = security(tickerid, res, signal)
outHist = security(tickerid, res, hist)

histA_IsUp = outHist > outHist[1] and outHist > 0
histA_IsDown = outHist < outHist[1] and outHist > 0
histB_IsDown = outHist < outHist[1] and outHist <= 0
histB_IsUp = outHist > outHist[1] and outHist <= 0

//MacD Color Definitions
macd_IsAbove = outMacD >= outSignal
macd_IsBelow = outMacD < outSignal

plot_color = hist_colorChange ? histA_IsUp ? aqua : histA_IsDown ? blue : histB_IsDown ? red : histB_IsUp ? maroon :yellow :gray
macd_color = macd_colorChange ? macd_IsAbove ? lime : red : red
signal_color = macd_colorChange ? macd_IsAbove ? yellow : yellow : lime

circleYPosition = outSignal
 
plot(smd and outMacD ? outMacD : na, title="MACD", color=macd_color, linewidth=4)
plot(smd and outSignal ? outSignal : na, title="Signal Line", color=signal_color, style=line ,linewidth=2)
plot(sh and outHist ? outHist : na, title="Histogram", color=plot_color, style=histogram, linewidth=4)
plot(sd and cross(outMacD, outSignal) ? circleYPosition : na, title="Cross", style=circles, linewidth=4, color=macd_color)
hline(0, '0 Line', linestyle=solid, linewidth=2, color=white)