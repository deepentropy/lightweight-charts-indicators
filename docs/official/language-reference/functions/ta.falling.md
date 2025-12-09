### ta.falling()

Test if the `source` series is now falling for `length` bars long.

Syntax

```
ta.falling(source, length) → series bool
```

Arguments

source (series int/float) Series of values to process.

length (series int) Number of bars (length).

Returns

true if current `source` value is less than any previous `source` value for `length` bars back, false otherwise.

Remarks

`na` values in the `source` series are ignored; the function calculates on the `length` quantity of non-`na` values.

See also

[ta.rising](#fun_ta.rising)
