### ta.linreg()

Linear regression curve. A line that best fits the prices specified over a user-defined time period. It is calculated using the least squares method. The result of this function is calculated using the formula: linreg = intercept + slope \* (length - 1 - offset), where intercept and slope are the values calculated with the least squares method on `source` series.

Syntax

```
ta.linreg(source, length, offset) → series float
```

Arguments

source (series int/float) Source series.

length (series int) Number of bars (length).

offset (simple int) Offset.

Returns

Linear regression curve.

Remarks

`na` values in the `source` series are included in calculations and will produce an `na` result.
