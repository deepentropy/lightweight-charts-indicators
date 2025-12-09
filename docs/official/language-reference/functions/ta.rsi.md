### ta.rsi()

Relative strength index. It is calculated using the `ta.rma()` of upward and downward changes of `source` over the last `length` bars.

Syntax

```
ta.rsi(source, length) → series float
```

Arguments

source (series int/float) Series of values to process.

length (simple int) Number of bars (length).

Example

```
//@version=6  
indicator("ta.rsi")  
plot(ta.rsi(close, 7))  
  
// same on pine, but less efficient  
pine_rsi(x, y) =>  
    u = math.max(x - x[1], 0) // upward ta.change  
    d = math.max(x[1] - x, 0) // downward ta.change  
    rs = ta.rma(u, y) / ta.rma(d, y)  
    res = 100 - 100 / (1 + rs)  
    res  
  
plot(pine_rsi(close, 7))
```

Returns

Relative strength index.

Remarks

`na` values in the `source` series are ignored; the function calculates on the `length` quantity of non-`na` values.

See also

[ta.rma](#fun_ta.rma)
