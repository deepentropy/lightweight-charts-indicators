### ta.mom()

Momentum of `source` price and `source` price `length` bars ago. This is simply a difference: source - source[length].

Syntax

```
ta.mom(source, length) → series float
```

Arguments

source (series int/float) Series of values to process.

length (series int) Offset from the current bar to the previous bar.

Returns

Momentum of `source` price and `source` price `length` bars ago.

Remarks

`na` values in the `source` series are included in calculations and will produce an `na` result.

See also

[ta.change](#fun_ta.change)
