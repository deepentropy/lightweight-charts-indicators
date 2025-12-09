### ta.range()

2 overloads

Returns the difference between the min and max values in a series.

Syntax & Overloads

[```
ta.range(source, length) → series int
```](#fun_ta.range-0)[```
ta.range(source, length) → series float
```](#fun_ta.range-1)

Arguments

source (series int) Series of values to process.

length (series int) Number of bars (length).

Returns

The difference between the min and max values in the series.

Remarks

`na` values in the `source` series are ignored; the function calculates on the `length` quantity of non-`na` values.
