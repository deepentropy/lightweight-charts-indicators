### ta.vwma()

The vwma function returns volume-weighted moving average of `source` for `length` bars back. It is the same as: sma(source \* volume, length) / sma(volume, length).

Syntax

```
ta.vwma(source, length) → series float
```

Arguments

source (series int/float) Series of values to process.

length (series int) Number of bars (length).

Example

```
//@version=6  
indicator("ta.vwma")  
plot(ta.vwma(close, 15))  
  
// same on pine, but less efficient  
pine_vwma(x, y) =>  
    ta.sma(x * volume, y) / ta.sma(volume, y)  
plot(pine_vwma(close, 15))
```

Returns

Volume-weighted moving average of `source` for `length` bars back.

Remarks

`na` values in the `source` series are ignored.

See also

[ta.sma](#fun_ta.sma)[ta.ema](#fun_ta.ema)[ta.rma](#fun_ta.rma)[ta.wma](#fun_ta.wma)[ta.swma](#fun_ta.swma)[ta.alma](#fun_ta.alma)
