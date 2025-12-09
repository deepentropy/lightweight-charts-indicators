### ta.mode()

2 overloads

Returns the [mode](https://en.wikipedia.org/wiki/Mode_(statistics)) of the series. If there are several values with the same frequency, it returns the smallest value.

Syntax & Overloads

[```
ta.mode(source, length) → series int
```](#fun_ta.mode-0)[```
ta.mode(source, length) → series float
```](#fun_ta.mode-1)

Arguments

source (series int) Series of values to process.

length (series int) Number of bars (length).

Returns

The most frequently occurring value from the `source`. If none exists, returns the smallest value instead.

Remarks

`na` values in the `source` series are ignored; the function calculates on the `length` quantity of non-`na` values.
