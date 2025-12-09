### if

If statement defines what block of statements must be executed when conditions of the expression are satisfied.

To have access to and use the if statement, one should specify the version >= 2 of Pine Script® language in the very first line of code, for example: //@version=6

The 4th version of Pine Script® Language allows you to use “else if” syntax.

General code form:

Syntax

```
var_declarationX = if condition
    var_decl_then0
    var_decl_then1
    …
    var_decl_thenN
else if [optional block]
    var_decl_else0
    var_decl_else1
    …
    var_decl_elseN
else
    var_decl_else0
    var_decl_else1
    …
    var_decl_elseN
    return_expression_else
```

where

**var\_declarationX** — this variable gets the value of the if statement

**condition** — if the condition is true, the logic from the block 'then' (var\_decl\_then0, var\_decl\_then1, etc.) is used.

If the condition is false, the logic from the block 'else' (var\_decl\_else0, var\_decl\_else1, etc.) is used.

**return\_expression\_then**, **return\_expression\_else** — the last expression from the block then or from the block else will return the final value of the statement. If declaration of the variable is in the end, its value will be the result.

The type of returning value of the if statement depends on return\_expression\_then and return\_expression\_else type (their types must match: it is not possible to return an integer value from then, while you have a string value in else block).

Example

```
//@version=6  
indicator("if")  
// This code compiles  
x = if close > open  
    close  
else  
    open  
  
// This code doesn’t compile  
// y = if close > open  
//     close  
// else  
//     "open"  
plot(x)
```

It is possible to omit the `else` block. In this case if the condition is false, an “empty” value (na, false, or “”) will be assigned to the var\_declarationX variable:

Example

```
//@version=6  
indicator("if")  
x = if close > open  
    close  
// If current close > current open, then x = close.  
// Otherwise the x = na.  
plot(x)
```

It is possible to use either multiple “else if” blocks or none at all. The blocks “then”, “else if”, “else” are shifted by four spaces:

Example

```
//@version=6  
indicator("if")  
x = if open > close  
    5  
else if high > low  
    close  
else  
    open  
plot(x)
```

It is possible to ignore the resulting value of an `if` statement (“var\_declarationX=“ can be omitted). It may be useful if you need the side effect of the expression, for example in strategy trading:

Example

```
//@version=6  
strategy("if")  
if (ta.crossover(high, low))  
    strategy.entry("BBandLE", strategy.long, stop=low, oca_name="BollingerBands", oca_type=strategy.oca.cancel, comment="BBandLE")  
else  
    strategy.cancel(id="BBandLE")
```

If statements can include each other:

Example

```
//@version=6  
indicator("if")  
float x = na  
if close > open  
    if close > close[1]  
        x := close  
    else  
        x := close[1]  
else  
    x := open  
plot(x)
```
