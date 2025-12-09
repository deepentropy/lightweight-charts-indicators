### na()

2 overloads

Tests if `x` is [na](#var_na).

Syntax & Overloads

[```
na(x) → simple bool
```](#fun_na-0)[```
na(x) → series bool
```](#fun_na-1)

Arguments

x (simple int/float) Value to be tested.

Example

```
//@version=6  
indicator("na")  
// Use the `na()` function to test for `na`.  
plot(na(close[1]) ? close : close[1])  
// ALTERNATIVE  
// `nz()` also tests `close[1]` for `na`. It returns `close[1]` if it is not `na`, and `close` if it is.  
plot(nz(close[1], close))
```

Returns

Returns [true](#const_true) if `x` is [na](#var_na), [false](#const_false) otherwise.

See also

[na](#var_na)[fixnan](#fun_fixnan)[nz](#fun_nz)
