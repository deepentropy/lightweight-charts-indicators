### ta.macd()

MACD (moving average convergence/divergence). It is supposed to reveal changes in the strength, direction, momentum, and duration of a trend in a stock's price.

Syntax

```
ta.macd(source, fastlen, slowlen, siglen) → [series float, series float, series float]
```

Arguments

source (series int/float) Series of values to process.

fastlen (simple int) Fast Length parameter.

slowlen (simple int) Slow Length parameter.

siglen (simple int) Signal Length parameter.

Example

```
//@version=6  
indicator("MACD")  
[macdLine, signalLine, histLine] = ta.macd(close, 12, 26, 9)  
plot(macdLine, color=color.blue)  
plot(signalLine, color=color.orange)  
plot(histLine, color=color.red, style=plot.style_histogram)
```

If you need only one value, use placeholders '\_' like this:

Example

```
//@version=6  
indicator("MACD")  
[_, signalLine, _] = ta.macd(close, 12, 26, 9)  
plot(signalLine, color=color.orange)
```

Returns

[Tuple](https://www.tradingview.com/pine-script-docs/language/type-system/#tuples) of three MACD series: MACD line, signal line and histogram line.

Remarks

`na` values in the `source` series are ignored; the function calculates on the `length` quantity of non-`na` values.

See also

[ta.sma](#fun_ta.sma)[ta.ema](#fun_ta.ema)
