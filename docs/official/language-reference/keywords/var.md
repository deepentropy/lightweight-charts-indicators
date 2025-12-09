### var

**var** is the keyword used for assigning and one-time initializing of the variable.

Normally, a syntax of assignment of variables, which doesn’t include the keyword var, results in the value of the variable being overwritten with every update of the data. Contrary to that, when assigning variables with the keyword var, they can “keep the state” despite the data updating, only changing it when conditions within if-expressions are met.

Syntax

```
var variable_name = expression
```

where:

**variable\_name** - any name of the user’s variable that’s allowed in Pine Script® (can contain capital and lowercase Latin characters, numbers, and underscores (\_), but can’t start with a number).

**expression** - any arithmetic expression, just as with defining a regular variable. The expression will be calculated and assigned to a variable once.

Example

```
//@version=6  
indicator("Var keyword example")  
var a = close  
var b = 0.0  
var c = 0.0  
var green_bars_count = 0  
if close > open  
    var x = close  
    b := x  
    green_bars_count := green_bars_count + 1  
    if green_bars_count >= 10  
        var y = close  
        c := y  
plot(a)  
plot(b)  
plot(c)
```

The variable 'a' keeps the closing price of the first bar for each bar in the series.

The variable 'b' keeps the closing price of the first "green" bar in the series.

The variable 'c' keeps the closing price of the tenth "green" bar in the series.
