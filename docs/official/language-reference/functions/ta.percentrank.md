### ta.percentrank()

Percent rank is the percents of how many previous values was less than or equal to the current value of given series.

Syntax

```
ta.percentrank(source, length) → series float
```

Arguments

source (series int/float) Series of values to process.

length (series int) Number of bars (length).

Returns

Percent rank of `source` for `length` bars back.

Remarks

`na` values in the `source` series are included in calculations and will produce an `na` result.
