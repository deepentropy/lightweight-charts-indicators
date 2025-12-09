### simple

The `simple` keyword explicitly assigns the "simple" type qualifier to variables and function parameters. Variables and parameters that use the "simple" qualifier can reference values established at the beginning of a script's execution that do not change later.

To restrict the parameters in a library's exported functions to only allow values with a "simple" or weaker type qualifier, using the `simple` keyword when declaring parameters is often necessary, as libraries automatically qualify all parameters as "series" wherever possible by default. Explicitly restricting functions to accept "simple" arguments also allows them to return "simple" values in some cases, depending on the operations they execute, making them usable with the parameters of built-in functions that do not allow "series" arguments.

In variable declarations, the compiler can usually infer the qualified type automatically based on the values assigned to a variable, and it can automatically change a variable's qualifier to a stronger one when necessary. The type qualifier hierarchy is "const" < "input" < "simple" < "series", where "simple" is stronger than "input" and "const".

Explicitly declaring a variable with the `simple` keyword restricts the type qualifier to "simple", meaning the script cannot pass its value to any variable or function parameter that requires a value with a weaker qualifier ("const" or "input"). Additionally, one cannot assign a "series" value to a variable explicitly declared with the `simple` keyword.

When using this keyword to specify the type qualifier, one must also use a type keyword to declare the allowed type.

Syntax

```
export [method ]<functionName>([[simple ]<paramType>] <paramName>[ = <defaultValue>])

[method ]<functionName>([simple <paramType> ]<paramName>[ = <defaultValue>])

[var/varip ]simple <variableType> <variableName> = <variableValue></variableValue>
```

Example

```
//@version=6  
//@description A library with custom functions.  
library("CustomFunctions", overlay = true)  
  
//@function         Calculates the length values for a ribbon of four EMAs by multiplying the `baseLength`.  
//@param baseLength The initial EMA length. Requires "simple int" because you can't use "series int" in `ta.ema()`.  
//@returns          A tuple of length values.  
export ribbonLengths(simple int baseLength) =>  
    simple int length1 = baseLength  
    simple int length2 = baseLength * 2  
    simple int length3 = baseLength * 3  
    simple int length4 = baseLength * 4  
    [length1, length2, length3, length4]  
  
// Get a tuple of "simple int" length values.  
[len1, len2, len3, len4] = ribbonLengths(14)  
  
// Plot four EMAs using the values from the tuple.  
plot(ta.ema(close, len1), "EMA 1", color = color.red)  
plot(ta.ema(close, len2), "EMA 1", color = color.orange)  
plot(ta.ema(close, len3), "EMA 1", color = color.green)  
plot(ta.ema(close, len4), "EMA 1", color = color.blue)
```

Example

```
//@version=6  
indicator("can't change simple to series")  
  
//@variable A variable declared as "simple float" with a value of 5.0.  
simple float myVar = 5.0  
  
// This reassignment causes an error.  
// The `close` variable returns a "series float" value. Since `myVar` is restricted to "simple" values, it cannot  
// change its qualifier to "series".  
myVar := close  
  
plot(myVar)
```

Remarks

To learn more, see our User Manual's section on [type qualifiers](https://www.tradingview.com/pine-script-docs/language/type-system/#qualifiers).

See also

[series](#type_series)[const](#type_const)
