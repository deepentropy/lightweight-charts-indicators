### ta.stoch()

Stochastic. It is calculated by a formula: 100 \* (close - lowest(low, length)) / (highest(high, length) - lowest(low, length)).

Syntax

```
ta.stoch(source, high, low, length) → series float
```

Arguments

source (series int/float) Source series.

high (series int/float) Series of high.

low (series int/float) Series of low.

length (series int) Length (number of bars back).

Returns

Stochastic.

Remarks

`na` values in the `source` series are ignored.

See also

[ta.cog](#fun_ta.cog)
