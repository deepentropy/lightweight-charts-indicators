### int

Keyword used to explicitly declare the "int" (integer) type of a variable or a parameter.

Example

```
//@version=6  
indicator("int")  
int i = 14    // Same as `i = 14`  
i := na  
plot(i)
```

Remarks

Explicitly mentioning the type in a variable declaration is optional, except when it is initialized with [na](#var_na). Learn more about Pine Script® types in the User Manual page on the [Type System](https://www.tradingview.com/pine-script-docs/language/type-system/).

See also

[var](#kw_var)[varip](#kw_varip)[float](#type_float)[bool](#type_bool)[color](#type_color)[string](#type_string)
