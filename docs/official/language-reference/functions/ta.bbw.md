### ta.bbw()

Bollinger Bands Width. The Bollinger Band Width is the difference between the upper and the lower Bollinger Bands divided by the middle band.

Syntax

```
ta.bbw(series, length, mult) → series float
```

Arguments

series (series int/float) Series of values to process.

length (series int) Number of bars (length).

mult (simple int/float) Standard deviation factor.

Example

```
//@version=6  
indicator("ta.bbw")  
  
plot(ta.bbw(close, 5, 4), color=color.yellow)  
  
// the same on pine  
f_bbw(src, length, mult) =>  
    float basis = ta.sma(src, length)  
    float dev = mult * ta.stdev(src, length)  
    (((basis + dev) - (basis - dev)) / basis) * 100  
  
plot(f_bbw(close, 5, 4))
```

Returns

Bollinger Bands Width.

Remarks

`na` values in the `source` series are ignored; the function calculates on the `length` quantity of non-`na` values.

See also

[ta.bb](#fun_ta.bb)[ta.sma](#fun_ta.sma)[ta.stdev](#fun_ta.stdev)
