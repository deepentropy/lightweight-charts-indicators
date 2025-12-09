### ta.wma()

The wma function returns weighted moving average of `source` for `length` bars back. In wma weighting factors decrease in arithmetical progression.

Syntax

```
ta.wma(source, length) → series float
```

Arguments

source (series int/float) Series of values to process.

length (series int) Number of bars (length).

Example

```
//@version=6  
indicator("ta.wma")  
plot(ta.wma(close, 15))  
  
// same on pine, but much less efficient  
pine_wma(x, y) =>  
    norm = 0.0  
    sum = 0.0  
    for i = 0 to y - 1  
        weight = (y - i) * y  
        norm := norm + weight  
        sum := sum + x[i] * weight  
    sum / norm  
plot(pine_wma(close, 15))
```

Returns

Weighted moving average of `source` for `length` bars back.

Remarks

`na` values in the `source` series are ignored.

See also

[ta.sma](#fun_ta.sma)[ta.ema](#fun_ta.ema)[ta.rma](#fun_ta.rma)[ta.vwma](#fun_ta.vwma)[ta.swma](#fun_ta.swma)[ta.alma](#fun_ta.alma)
