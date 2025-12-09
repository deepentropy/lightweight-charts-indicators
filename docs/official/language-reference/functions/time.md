### time()

2 overloads

The time function returns the UNIX time of the current bar for the specified timeframe and session or NaN if the time point is out of session.

Syntax & Overloads

[```
time(timeframe, session, bars_back, timeframe_bars_back) → series int
```](#fun_time-0)[```
time(timeframe, session, timezone, bars_back, timeframe_bars_back) → series int
```](#fun_time-1)

Arguments

timeframe (series string) Timeframe. An empty string is interpreted as the current timeframe of the chart.

session (series string) Session specification. Optional argument, session of the symbol is used by default. An empty string is interpreted as the session of the symbol.

bars\_back (series int) Optional. The bar offset on the script's main timeframe. If the value is positive, the function retrieves the timestamp of the bar N bars back relative to the current bar on the main timeframe. If the value is a negative number from -1 to -500, the function retrieves the expected time of a future bar on that timeframe. The default is 0.

timeframe\_bars\_back (series int) Optional. The bar offset on the timeframe specified by the `timeframe` parameter. If the value is positive, the function retrieves the timestamp of the bar N bars back relative to the bar on the specified timeframe. If the value is a negative number from -1 to -500, the function retrieves the expected time of a future bar on that timeframe. The default is 0.

Example

```
//@version=6  
indicator("Time", overlay=true)  
// Try this on chart AAPL,1  
timeinrange(res, sess) => not na(time(res, sess, "America/New_York")) ? 1 : 0  
plot(timeinrange("1", "1300-1400"), color=color.red)  
  
// This plots 1.0 at every start of 10 minute bar on a 1 minute chart:  
newbar(res) => ta.change(time(res)) == 0 ? 0 : 1  
plot(newbar("10"))
```

While setting up a session you can specify not just the hours and minutes but also the days of the week that will be included in that session.

If the days aren't specified, the session is considered to have been set from Sunday (1) to Saturday (7), i.e. "1100-2000" is the same as "1100-1200:1234567".

You can change that by specifying the days. For example, on a symbol that is traded seven days a week with the 24-hour trading session the following script will not color Saturdays and Sundays:

Example

```
//@version=6  
indicator("Time", overlay=true)  
t1 = time(timeframe.period, "0000-0000:23456")  
bgcolor(not na(t1) ? color.new(color.blue, 90) : na)
```

One `session` argument can include several different sessions, separated by commas. For example, the following script will highlight the bars from 10:00 to 11:00 and from 14:00 to 15:00 (workdays only):

Example

```
//@version=6  
indicator("Time", overlay=true)  
t1 = time(timeframe.period, "1000-1100,1400-1500:23456")  
bgcolor(not na(t1) ? color.new(color.blue, 90) : na)
```

Returns

UNIX time.

Remarks

UNIX time is the number of milliseconds that have elapsed since 00:00:00 UTC, 1 January 1970.

If the function call includes `bars_back` and `timeframe_bars_back` arguments, it evaluates the `bars_back` offset before the `timeframe_bars_back` offset. For example, consider the call `time(timeframe = "1M", bars_back = 15, timeframe_bars_back = 10)` on a "1D" chart. This function call references the bar from 15 bars back on the "1D" timeframe, determines the "1M" bar that the bar belongs to, and then retrieves the timestamp from 10 "1M" bars back relative to that "1M" bar.

See also

[time](#var_time)
