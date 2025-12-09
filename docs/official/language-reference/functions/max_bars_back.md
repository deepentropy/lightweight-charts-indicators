### max\_bars\_back()

Function sets the maximum number of bars that is available for historical reference of a given built-in or user variable. When operator '[]' is applied to a variable - it is a reference to a historical value of that variable.

If an argument of an operator '[]' is a compile time constant value (e.g. 'v[10]', 'close[500]') then there is no need to use 'max\_bars\_back' function for that variable. Pine Script® compiler will use that constant value as history buffer size.

If an argument of an operator '[]' is a value, calculated at runtime (e.g. 'v[i]' where 'i' - is a series variable) then Pine Script® attempts to autodetect the history buffer size at runtime. Sometimes it fails and the script crashes at runtime because it eventually refers to historical values that are out of the buffer. In that case you should use 'max\_bars\_back' to fix that problem manually.

Syntax

```
max_bars_back(var, num) → void
```

Arguments

var (series int/float/bool/color/label/line) Series variable identifier for which history buffer should be resized. Possible values are: 'open', 'high', 'low', 'close', 'volume', 'time', or any user defined variable id.

num (const int) History buffer size which is the number of bars that could be referenced for variable 'var'.

Example

```
//@version=6  
indicator("max_bars_back")  
close_() => close  
depth() => 400  
d = depth()  
v = close_()  
max_bars_back(v, 500)  
out = if bar_index > 0  
    v[d]  
else  
    v  
plot(out)
```

Returns

void

Remarks

At the moment 'max\_bars\_back' cannot be applied to built-ins like 'hl2', 'hlc3', 'ohlc4'. Please use multiple 'max\_bars\_back' calls as workaround here (e.g. instead of a single ‘max\_bars\_back(hl2, 100)’ call you should call the function twice: ‘max\_bars\_back(high, 100), max\_bars\_back(low, 100)’).

If the [indicator](#fun_indicator) or [strategy](#fun_strategy) 'max\_bars\_back' parameter is used, all variables in the indicator are affected. This may result in excessive memory usage and cause runtime problems. When possible (i.e. when the cause is a variable rather than a function), please use the [max\_bars\_back](#fun_max_bars_back) function instead.

See also

[indicator](#fun_indicator)
