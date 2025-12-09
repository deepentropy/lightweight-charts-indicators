### bool

Keyword used to explicitly declare the "bool" (boolean) type of a variable or a parameter. "Bool" variables can have values [true](#const_true) or [false](#const_false).

Example

```
//@version=6  
indicator("bool")  
bool b = true    // Same as `b = true`  
plot(b ? open : close)
```

Remarks

Explicitly mentioning the type in a variable declaration is optional. Learn more about Pine Script® types in the User Manual page on the [Type System](https://www.tradingview.com/pine-script-docs/language/type-system/).

See also

[var](#kw_var)[varip](#kw_varip)[int](#type_int)[float](#type_float)[color](#type_color)[string](#type_string)[true](#const_true)[false](#const_false)
