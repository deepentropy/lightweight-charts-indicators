### ta.alma()

Arnaud Legoux Moving Average. It uses Gaussian distribution as weights for moving average.

Syntax

```
ta.alma(series, length, offset, sigma, floor) → series float
```

Arguments

series (series int/float) Series of values to process.

length (series int) Number of bars (length).

offset (simple int/float) Controls tradeoff between smoothness (closer to 1) and responsiveness (closer to 0).

sigma (simple int/float) Changes the smoothness of ALMA. The larger sigma the smoother ALMA.

floor (simple bool) An optional parameter. Specifies whether the offset calculation is floored before ALMA is calculated. Default value is false.

Example

```
//@version=6  
indicator("ta.alma", overlay=true)  
plot(ta.alma(close, 9, 0.85, 6))  
  
// same on pine, but much less efficient  
pine_alma(series, windowsize, offset, sigma) =>  
    m = offset * (windowsize - 1)  
    //m = math.floor(offset * (windowsize - 1)) // Used as m when math.floor=true  
    s = windowsize / sigma  
    norm = 0.0  
    sum = 0.0  
    for i = 0 to windowsize - 1  
        weight = math.exp(-1 * math.pow(i - m, 2) / (2 * math.pow(s, 2)))  
        norm := norm + weight  
        sum := sum + series[windowsize - i - 1] * weight  
    sum / norm  
plot(pine_alma(close, 9, 0.85, 6))
```

Returns

Arnaud Legoux Moving Average.

Remarks

`na` values in the `source` series are included in calculations and will produce an `na` result.

See also

[ta.sma](#fun_ta.sma)[ta.ema](#fun_ta.ema)[ta.rma](#fun_ta.rma)[ta.wma](#fun_ta.wma)[ta.vwma](#fun_ta.vwma)[ta.swma](#fun_ta.swma)
