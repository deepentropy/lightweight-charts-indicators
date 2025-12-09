### ta.swma()

Symmetrically weighted moving average with fixed length: 4. Weights: [1/6, 2/6, 2/6, 1/6].

Syntax

```
ta.swma(source) → series float
```

Arguments

source (series int/float) Source series.

Example

```
//@version=6  
indicator("ta.swma")  
plot(ta.swma(close))  
  
// same on pine, but less efficient  
pine_swma(x) =>  
    x[3] * 1 / 6 + x[2] * 2 / 6 + x[1] * 2 / 6 + x[0] * 1 / 6  
plot(pine_swma(close))
```

Returns

Symmetrically weighted moving average.

Remarks

`na` values in the `source` series are included in calculations and will produce an `na` result.

See also

[ta.sma](#fun_ta.sma)[ta.ema](#fun_ta.ema)[ta.rma](#fun_ta.rma)[ta.wma](#fun_ta.wma)[ta.vwma](#fun_ta.vwma)[ta.alma](#fun_ta.alma)
