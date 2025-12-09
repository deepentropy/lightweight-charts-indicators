### timeframe.in\_seconds()

2 overloads

Converts a timeframe string into seconds.

Syntax & Overloads

[```
timeframe.in_seconds(timeframe) → simple int
```](#fun_timeframe.in_seconds-0)[```
timeframe.in_seconds(timeframe) → series int
```](#fun_timeframe.in_seconds-1)

Arguments

timeframe (simple string) Timeframe string in [timeframe string specifications](https://www.tradingview.com/pine-script-docs/concepts/timeframes/#timeframe-string-specifications) format. Optional. The default is [timeframe.period](#var_timeframe.period).

Example

```
//@version=6  
indicator("`timeframe_in_seconds()`"),  
  
// Get a user-selected timeframe.  
tfInput = input.timeframe("1D")  
  
// Convert it into an "int" number of seconds.  
secondsInTf = timeframe.in_seconds(tfInput)  
  
plot(secondsInTf)
```

Returns

The "int" representation of the number of seconds in the timeframe string.

Remarks

When the timeframe is "1M" or more, calculations use 2628003 as the number of seconds in one month, which represents 30.4167 (365/12) days.

See also

[input.timeframe](#fun_input.timeframe)[timeframe.period](#var_timeframe.period)[timeframe.from\_seconds](#fun_timeframe.from_seconds)
