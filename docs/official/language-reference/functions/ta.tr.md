### ta.tr()

Calculates the current bar's true range. Unlike a bar's actual range (`high - low`), true range accounts for potential gaps by taking the maximum of the current bar's actual range and the absolute distances from the previous bar's [close](#var_close) to the current bar's [high](#var_high) and [low](#var_low). The formula is: `math.max(high - low, math.abs(high - close[1]), math.abs(low - close[1]))`.

Syntax

```
ta.tr(handle_na) → series float
```

Arguments

handle\_na (simple bool) Defines how the function calculates the result when the previous bar's [close](#var_close) is [na](#var_na). If [true](#const_true), the function returns the bar's `high - low` value. If [false](#const_false), it returns [na](#var_na).

Returns

True range. It is math.max(high - low, math.abs(high - close[1]), math.abs(low - close[1])).

Remarks

ta.tr(false) is exactly the same as [ta.tr](#var_ta.tr).

See also

[ta.tr](#var_ta.tr)[ta.atr](#fun_ta.atr)
