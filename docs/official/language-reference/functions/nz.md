### nz()

6 overloads

Replaces [na](#var_na) (undefined) values with either a type-specific default value or a specified replacement.

Syntax & Overloads

[```
nz(source, replacement) → simple color
```](#fun_nz-0)[```
nz(source, replacement) → simple int
```](#fun_nz-1)[```
nz(source, replacement) → series color
```](#fun_nz-2)[```
nz(source, replacement) → series int
```](#fun_nz-3)[```
nz(source, replacement) → simple float
```](#fun_nz-4)[```
nz(source, replacement) → series float
```](#fun_nz-5)

Arguments

source (simple color) The source series to process.

replacement (simple color) Optional. The value the function uses to replace [na](#var_na) values in the `source` series. The default depends on the `source` type: `0` for "int", `0.0` for "float", or `#00000000` for "color".

Example

```
//@version=6  
indicator("nz", overlay=true)  
plot(nz(ta.sma(close, 100)))
```

Returns

The value of `source` if it is not `na`. If the value of `source` is `na`, returns zero, or the `replacement` argument when one is used.

See also

[na](#var_na)[na](#fun_na)[fixnan](#fun_fixnan)
