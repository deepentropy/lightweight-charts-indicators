### ta.rising()

Test if the `source` series is now rising for `length` bars long.

Syntax

```
ta.rising(source, length) → series bool
```

Arguments

source (series int/float) Series of values to process.

length (series int) Number of bars (length).

Returns

true if current `source` is greater than any previous `source` for `length` bars back, false otherwise.

Remarks

`na` values in the `source` series are ignored.

See also

[ta.falling](#fun_ta.falling)
