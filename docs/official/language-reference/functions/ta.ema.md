### ta.ema()

The ema function returns the exponentially weighted moving average. In ema weighting factors decrease exponentially. It calculates by using a formula: `EMA = alpha * source + (1 - alpha) * EMA[1]`, where `alpha = 2 / (length + 1)`.

Syntax

```
ta.ema(source, length) → series float
```

Arguments

source (series int/float) Series of values to process.

length (simple int) Number of bars (length).

Example

```
//@version=6  
indicator("ta.ema")  
plot(ta.ema(close, 15))  
  
//the same on pine  
pine_ema(src, length) =>  
    alpha = 2 / (length + 1)  
    sum = 0.0  
    sum := na(sum[1]) ? src : alpha * src + (1 - alpha) * nz(sum[1])  
plot(pine_ema(close,15))
```

Returns

Exponential moving average of `source` with alpha = 2 / (length + 1).

Remarks

Please note that using this variable/function can cause [indicator repainting](https://www.tradingview.com/pine-script-docs/concepts/repainting/).

`na` values in the `source` series are ignored; the function calculates on the `length` quantity of non-`na` values.

See also

[ta.sma](#fun_ta.sma)[ta.rma](#fun_ta.rma)[ta.wma](#fun_ta.wma)[ta.vwma](#fun_ta.vwma)[ta.swma](#fun_ta.swma)[ta.alma](#fun_ta.alma)
