### ta.percentile\_linear\_interpolation()

Calculates percentile using method of linear interpolation between the two nearest ranks.

Syntax

```
ta.percentile_linear_interpolation(source, length, percentage) → series float
```

Arguments

source (series int/float) Series of values to process (source).

length (series int) Number of bars back (length).

percentage (simple int/float) Percentage, a number from range 0..100.

Returns

P-th percentile of `source` series for `length` bars back.

Remarks

Note that a percentile calculated using this method will NOT always be a member of the input data set.

`na` values in the `source` series are included in calculations and will produce an `na` result.

See also

[ta.percentile\_nearest\_rank](#fun_ta.percentile_nearest_rank)
