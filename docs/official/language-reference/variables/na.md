### na

A keyword signifying "not available", indicating that a variable has no assigned value.

Type

simple na

Example

```
//@version=6  
indicator("na")  
// CORRECT  
// Plot no value when on bars zero to nine. Plot `close` on other bars.  
plot(bar_index < 10 ? na : close)  
// CORRECT ALTERNATIVE  
// Initialize `a` to `na`. Reassign `close` to `a` on bars 10 and later.  
float a = na  
if bar_index >= 10  
    a := close  
plot(a)  
  
// INCORRECT  
// Trying to test the preceding bar's `close` for `na`.  
// The next line, if uncommented, will cause a compilation error, because direct comparison with `na` is not allowed.  
// plot(close[1] == na ? close : close[1])  
// CORRECT  
// Use the `na()` function to test for `na`.  
plot(na(close[1]) ? close : close[1])  
// CORRECT ALTERNATIVE  
// `nz()` tests `close[1]` for `na`. It returns `close[1]` if it is not `na`, and `close` if it is.  
plot(nz(close[1], close))
```

Remarks

Do not use this variable with [comparison operators](https://www.tradingview.com/pine-script-docs/language/operators/#comparison-operators) to test values for `na`, as it might lead to unexpected behavior. Instead, use the [na](#fun_na) function. Note that `na` can be used to initialize variables when the initialization statement also specifies the variable's type.

See also

[na](#fun_na)[nz](#fun_nz)[fixnan](#fun_fixnan)
