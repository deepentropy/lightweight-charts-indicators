### ta.crossunder()

The `source1`-series is defined as having crossed under `source2`-series if, on the current bar, the value of `source1` is less than the value of `source2`, and on the previous bar, the value of `source1` was greater than or equal to the value of `source2`.

Syntax

```
ta.crossunder(source1, source2) → series bool
```

Arguments

source1 (series int/float) First data series.

source2 (series int/float) Second data series.

Returns

true if `source1` crossed under `source2` otherwise false.
