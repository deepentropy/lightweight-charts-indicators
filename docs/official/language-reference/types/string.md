### string

Keyword used to explicitly declare the "string" type of a variable or a parameter.

Example

```
//@version=6  
indicator("string")  
string s = "Hello World!"    // Same as `s = "Hello world!"`  
// string s = na // same as ""  
plot(na, title=s)
```

Remarks

Explicitly mentioning the type in a variable declaration is optional, except when it is initialized with [na](#var_na). Learn more about Pine Script® types in the User Manual page on the [Type System](https://www.tradingview.com/pine-script-docs/language/type-system/).

See also

[var](#kw_var)[varip](#kw_varip)[int](#type_int)[float](#type_float)[bool](#type_bool)[str.tostring](#fun_str.tostring)[str.format](#fun_str.format)
