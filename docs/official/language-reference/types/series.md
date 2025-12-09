### series

The `series` keyword explicitly assigns the "series" type qualifier to variables and function parameters. Variables and parameters that use the "series" qualifier can reference values that change throughout a script's execution.

Explicit use of the `series` keyword when declaring the parameters of a library's exported functions is typically unnecessary, as the compiler can usually automatically detect whether a parameter is compatible with "series" or "simple" qualified values. By default, all exported function parameters are qualified as "series" wherever possible.

In variable declarations, the compiler can usually infer the qualified type automatically based on the values assigned to a variable, and it can automatically change a variable's qualifier to a stronger one when necessary. The type qualifier hierarchy is "const" < "input" < "simple" < "series", where "series" is the strongest.

Explicitly declaring a variable with the `series` keyword restricts the type qualifier to "series", meaning the script cannot pass its value to any variable or function parameter that requires a value with a weaker qualifier ("const", "input", or "simple").

When using this keyword to specify the type qualifier, one must also use a type keyword to declare the allowed type.

Syntax

```
export [method ]<functionName>([[series ]<paramType>] <paramName>[ = <defaultValue>])

[method ]<functionName>([series <paramType> ]<paramName>[ = <defaultValue>])

[var/varip ]series <variableType> <variableName> = <variableValue>
```

Example

```
//@version=6  
//@description A library with custom functions.  
library("CustomFunctions", overlay = true)  
  
//@function Finds the highest `source` value over `length` bars, filtered by the `cond` condition.  
export conditionalHighest(series float source, series bool cond, series int length) =>  
    //@variable The highest `source` value from when the `cond` was `true` over `length` bars.  
    series float result = na  
    // Loop to find the highest value.  
    for i = 0 to length - 1  
        if cond[i]  
            value   = source[i]  
            result := math.max(nz(result, value), value)  
    // Return the `result`.  
    result  
  
//@variable Is `true` once every five bars.  
series bool condition = bar_index % 5 == 0  
  
//@variable The highest `close` value from every fifth bar over the last 100 bars.  
series float hiValue = conditionalHighest(close, condition, 100)  
  
plot(hiValue)  
bgcolor(condition ? color.new(color.teal, 80) : na)
```

Example

```
//@version=6  
indicator("series variable not allowed")  
  
//@variable A variable declared as "series int" with a value of 5.  
series int myVar = 5  
  
// This call causes an error.  
// The `histbase` accepts "input int/float". It can't accept the stronger "series int" qualified type.  
plot(close, style = plot.style_histogram, histbase = myVar)
```

Remarks

To learn more, see our User Manual's section on [type qualifiers](https://www.tradingview.com/pine-script-docs/language/type-system/#qualifiers).

See also

[simple](#type_simple)[const](#type_const)
