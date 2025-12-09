### const

The `const` keyword explicitly assigns the "const" type qualifier to variables and the parameters of non-exported functions. Variables and parameters with the "const" qualifier reference values established at compile time that never change in the script's execution.

In variable declarations, the compiler can usually infer the qualified type automatically based on the values assigned to a variable, and it can automatically change a variable's qualifier to a stronger one when necessary. The type qualifier hierarchy is "const" < "input" < "simple" < "series", where "const" is the weakest.

Explicitly declaring a variable with the `const` keyword restricts the type qualifier to "const", meaning the variable cannot accept a value with a stronger qualifier (e.g., "input"), nor can the value assigned to the variable change at any point in the script's execution.

When using this keyword to specify the type qualifier, one must also use a type keyword to declare the allowed type.

Syntax

```
[method ]<functionName>([const <paramType> ]<paramName>[ = <defaultValue>])

[var/varip ]const <variableType> <variableName> = <variableValue>
```

Example

```
//@version=6  
indicator("custom plot title")  
  
//@function Concatenates two "const string" values.  
concatStrings(const string x, const string y) =>  
    const string result = x + y  
  
//@variable The title of the plot.  
const string myTitle = concatStrings("My ", "Plot")  
  
plot(close, myTitle)
```

Example

```
//@version=6  
indicator("can't assign input to const")  
  
//@variable A variable declared as "const float" that attempts to assign the result of `input.float()` as its value.  
//          This declaration causes an error. The "input float" qualified type is stronger than "const float".  
const float myVar = input.float(2.0)  
  
plot(myVar)
```

Remarks

To learn more, see our User Manual's section on [type qualifiers](https://www.tradingview.com/pine-script-docs/language/type-system/#qualifiers).

See also

[simple](#type_simple)[series](#type_series)
