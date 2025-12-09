### ta.supertrend()

The Supertrend Indicator. The Supertrend is a trend following indicator.

Syntax

```
ta.supertrend(factor, atrPeriod) → [series float, series float]
```

Arguments

factor (series int/float) The multiplier by which the ATR will get multiplied.

atrPeriod (simple int) Length of ATR.

Example

```
//@version=6  
indicator("Pine Script® Supertrend")  
  
[supertrend, direction] = ta.supertrend(3, 10)  
plot(direction < 0 ? supertrend : na, "Up direction", color = color.green, style=plot.style_linebr)  
plot(direction > 0 ? supertrend : na, "Down direction", color = color.red, style=plot.style_linebr)  
  
// The same on Pine Script®  
pine_supertrend(factor, atrPeriod) =>  
    src = hl2  
    atr = ta.atr(atrPeriod)  
    upperBand = src + factor * atr  
    lowerBand = src - factor * atr  
    prevLowerBand = nz(lowerBand[1])  
    prevUpperBand = nz(upperBand[1])  
  
    lowerBand := lowerBand > prevLowerBand or close[1] < prevLowerBand ? lowerBand : prevLowerBand  
    upperBand := upperBand < prevUpperBand or close[1] > prevUpperBand ? upperBand : prevUpperBand  
    int _direction = na  
    float superTrend = na  
    prevSuperTrend = superTrend[1]  
    if na(atr[1])  
        _direction := 1  
    else if prevSuperTrend == prevUpperBand  
        _direction := close > upperBand ? -1 : 1  
    else  
        _direction := close < lowerBand ? 1 : -1  
    superTrend := _direction == -1 ? lowerBand : upperBand  
    [superTrend, _direction]  
  
[Pine_Supertrend, pineDirection] = pine_supertrend(3, 10)  
plot(pineDirection < 0 ? Pine_Supertrend : na, "Up direction", color = color.green, style=plot.style_linebr)  
plot(pineDirection > 0 ? Pine_Supertrend : na, "Down direction", color = color.red, style=plot.style_linebr)
```

Returns

[Tuple](https://www.tradingview.com/pine-script-docs/language/type-system/#tuples) of two supertrend series: supertrend line and direction of trend. Possible values are 1 (down direction) and -1 (up direction).

See also

[ta.macd](#fun_ta.macd)
