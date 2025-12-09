### ta.sma()

The sma function returns the moving average, that is the sum of last y values of x, divided by y.

Syntax

```
ta.sma(source, length) → series float
```

Arguments

source (series int/float) Series of values to process.

length (series int) Number of bars (length).

Example

```
//@version=6  
indicator("ta.sma")  
plot(ta.sma(close, 15))  
  
// same on pine, but much less efficient  
pine_sma(x, y) =>  
    sum = 0.0  
    for i = 0 to y - 1  
        sum := sum + x[i] / y  
    sum  
plot(pine_sma(close, 15))
```

Returns

Simple moving average of `source` for `length` bars back.

Remarks

`na` values in the `source` series are ignored.

See also

[ta.ema](#fun_ta.ema)[ta.rma](#fun_ta.rma)[ta.wma](#fun_ta.wma)[ta.vwma](#fun_ta.vwma)[ta.swma](#fun_ta.swma)[ta.alma](#fun_ta.alma)
