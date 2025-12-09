### ta.variance()

Variance is the expectation of the squared deviation of a series from its mean ([ta.sma](#fun_ta.sma)), and it informally measures how far a set of numbers are spread out from their mean.

Syntax

```
ta.variance(source, length, biased) → series float
```

Arguments

source (series int/float) Series of values to process.

length (series int) Number of bars (length).

biased (series bool) Determines which estimate should be used. Optional. The default is true.

Returns

Variance of `source` for `length` bars back.

Remarks

If `biased` is true, function will calculate using a biased estimate of the entire population, if false - unbiased estimate of a sample.

`na` values in the `source` series are ignored; the function calculates on the `length` quantity of non-`na` values.

See also

[ta.dev](#fun_ta.dev)[ta.stdev](#fun_ta.stdev)
