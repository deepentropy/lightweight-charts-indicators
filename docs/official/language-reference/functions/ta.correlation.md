### ta.correlation()

Correlation coefficient. Describes the degree to which two series tend to deviate from their [ta.sma](#fun_ta.sma) values.

Syntax

```
ta.correlation(source1, source2, length) → series float
```

Arguments

source1 (series int/float) Source series.

source2 (series int/float) Target series.

length (series int) Length (number of bars back).

Returns

Correlation coefficient.

Remarks

`na` values in the `source` series are ignored; the function calculates on the `length` quantity of non-`na` values.

See also

[request.security](#fun_request.security)
