### ta.rci()

Calculates the Rank Correlation Index (RCI), which measures the directional consistency of price movements. It evaluates the monotonic relationship between a `source` series and the bar index over `length` bars using Spearman's rank correlation coefficient. The resulting value is scaled to a range of -100 to 100, where 100 indicates the `source` consistently increased over the period, and -100 indicates it consistently decreased. Values between -100 and 100 reflect varying degrees of upward or downward consistency.

Syntax

```
ta.rci(source, length) → series float
```

Arguments

source (series int/float) Series of values to process.

length (simple int) Number of bars (length).

Returns

The Rank Correlation Index, a value between -100 to 100.

See also
