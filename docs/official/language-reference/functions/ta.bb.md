### ta.bb()

Bollinger Bands. A Bollinger Band is a technical analysis tool defined by a set of lines plotted two standard deviations (positively and negatively) away from a simple moving average (SMA) of the security's price, but can be adjusted to user preferences.

Syntax

```
ta.bb(series, length, mult) → [series float, series float, series float]
```

Arguments

series (series int/float) Series of values to process.

length (series int) Number of bars (length).

mult (simple int/float) Standard deviation factor.

Example

```
//@version=6  
indicator("ta.bb")  
  
[middle, upper, lower] = ta.bb(close, 5, 4)  
plot(middle, color=color.yellow)  
plot(upper, color=color.yellow)  
plot(lower, color=color.yellow)  
  
// the same on pine  
f_bb(src, length, mult) =>  
    float basis = ta.sma(src, length)  
    float dev = mult * ta.stdev(src, length)  
    [basis, basis + dev, basis - dev]  
  
[pineMiddle, pineUpper, pineLower] = f_bb(close, 5, 4)  
  
plot(pineMiddle)  
plot(pineUpper)  
plot(pineLower)
```

Returns

Bollinger Bands.

Remarks

`na` values in the `source` series are ignored; the function calculates on the `length` quantity of non-`na` values.

See also

[ta.sma](#fun_ta.sma)[ta.stdev](#fun_ta.stdev)[ta.kc](#fun_ta.kc)
