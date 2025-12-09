### time\_close()

2 overloads

Returns the UNIX time of the current bar's close for the specified timeframe and session, or na if the time point is outside the session. On tick charts and price-based charts such as Renko, line break, Kagi, point & figure, and range, this function returns an [na](#var_na) timestamp for the latest realtime bar (because the future closing time is unpredictable), but a valid timestamp for any previous bar.

Syntax & Overloads

[```
time_close(timeframe, session, bars_back, timeframe_bars_back) → series int
```](#fun_time_close-0)[```
time_close(timeframe, session, timezone, bars_back, timeframe_bars_back) → series int
```](#fun_time_close-1)

Arguments

timeframe (series string) Resolution. An empty string is interpreted as the current resolution of the chart.

session (series string) Session specification. Optional argument, session of the symbol is used by default. An empty string is interpreted as the session of the symbol.

bars\_back (series int) Optional. The bar offset on the script's main timeframe. If the value is positive, the function retrieves the timestamp of the bar N bars back relative to the current bar on the main timeframe. If the value is a negative number from -1 to -500, the function retrieves the expected time of a future bar on that timeframe. The default is 0.

timeframe\_bars\_back (series int) Optional. The bar offset on the timeframe specified by the `timeframe` parameter. If the value is positive, the function retrieves the timestamp of the bar N bars back relative to the bar on the specified timeframe. If the value is a negative number from -1 to -500, the function retrieves the expected time of a future bar on that timeframe. The default is 0.

Example

```
//@version=6  
indicator("Time", overlay=true)  
t1 = time_close(timeframe.period, "1200-1300", "America/New_York")  
bgcolor(not na(t1) ? color.new(color.blue, 90) : na)
```

Returns

UNIX time.

Remarks

UNIX time is the number of milliseconds that have elapsed since 00:00:00 UTC, 1 January 1970.

If the function call includes `bars_back` and `timeframe_bars_back` arguments, it evaluates the `bars_back` offset before the `timeframe_bars_back` offset. For example, consider the call `time(timeframe = "1M", bars_back = 15, timeframe_bars_back = 10)` on a "1D" chart. This function call references the bar from 15 bars back on the "1D" timeframe, determines the "1M" bar that the bar belongs to, and then retrieves the timestamp from 10 "1M" bars back relative to that "1M" bar.

See also

[time\_close](#var_time_close)
