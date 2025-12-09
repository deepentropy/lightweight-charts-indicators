### ta.tsi()

True strength index. It uses moving averages of the underlying momentum of a financial instrument.

Syntax

```
ta.tsi(source, short_length, long_length) → series float
```

Arguments

source (series int/float) Source series.

short\_length (simple int) Short length.

long\_length (simple int) Long length.

Returns

True strength index. A value in range [-1, 1].

Remarks

`na` values in the `source` series are ignored; the function calculates on the `length` quantity of non-`na` values.
