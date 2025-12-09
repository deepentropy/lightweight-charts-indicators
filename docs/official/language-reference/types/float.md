### float

Keyword used to explicitly declare the "float" (floating point) type of a variable or a parameter.

Example

```
//@version=6  
indicator("float")  
float f = 3.14    // Same as `f = 3.14`  
f := na  
plot(f)
```

Remarks

Explicitly mentioning the type in a variable declaration is optional, except when it is initialized with [na](#var_na). Learn more about Pine Script® types in the User Manual page on the [Type System](https://www.tradingview.com/pine-script-docs/language/type-system/).

See also

[var](#kw_var)[varip](#kw_varip)[int](#type_int)[bool](#type_bool)[color](#type_color)[string](#type_string)
