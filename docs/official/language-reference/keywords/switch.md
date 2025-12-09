### switch

The switch operator transfers control to one of the several statements, depending on the values of a condition and expressions.

Syntax

```
[variable_declaration = ] switch expression
    value1 => local_block
    value2 => local_block
    …
    => default_local_block

[variable_declaration = ] switch
    condition1 => local_block
    condition2 => local_block
    …
    => default_local_block
```

Switch with an expression:

Example

```
//@version=6  
indicator("Switch using an expression")  
  
string i_maType = input.string("EMA", "MA type", options = ["EMA", "SMA", "RMA", "WMA"])  
  
float ma = switch i_maType  
    "EMA" => ta.ema(close, 10)  
    "SMA" => ta.sma(close, 10)  
    "RMA" => ta.rma(close, 10)  
    // Default used when the three first cases do not match.  
    => ta.wma(close, 10)  
  
plot(ma)
```

Switch without an expression:

Example

```
//@version=6  
strategy("Switch without an expression", overlay = true)  
  
bool longCondition  = ta.crossover( ta.sma(close, 14), ta.sma(close, 28))  
bool shortCondition = ta.crossunder(ta.sma(close, 14), ta.sma(close, 28))  
  
switch  
    longCondition  => strategy.entry("Long ID", strategy.long)  
    shortCondition => strategy.entry("Short ID", strategy.short)
```

Returns

The value of the last expression in the local block of statements that is executed.

Remarks

Only one of the `local_block` instances or the `default_local_block` can be executed. The `default_local_block` is introduced with the `=>` token alone and is only executed when none of the preceding blocks are executed. If the result of the `switch` statement is assigned to a variable and a `default_local_block` is not specified, the statement returns `na` if no `local_block` is executed. When assigning the result of the `switch` statement to a variable, all `local_block` instances must return the same type of value.

See also

[if](#kw_if)[?:](#op_?:)
