### ta.highest()

Highest value for a given number of bars back.

Syntax

```
ta.highest(source, length) → series float
```

Arguments

source (series int/float) Series of values to process.

length (series int) Number of bars (length).

Returns

Highest value in the series.

Remarks

Two args version: `source` is a series and `length` is the number of bars back.

One arg version: `length` is the number of bars back. Algorithm uses high as a `source` series.

`na` values in the `source` series are ignored.

See also

[ta.lowest](#fun_ta.lowest)[ta.lowestbars](#fun_ta.lowestbars)[ta.highestbars](#fun_ta.highestbars)[ta.valuewhen](#fun_ta.valuewhen)[ta.barssince](#fun_ta.barssince)
