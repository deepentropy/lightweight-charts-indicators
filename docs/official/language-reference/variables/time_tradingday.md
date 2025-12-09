### time\_tradingday

The timestamp that represents 00:00 UTC of the trading day the current bar belongs to, in UNIX format (the number of milliseconds that have elapsed since 00:00:00 UTC, 1 January 1970).

Type

series int

Example

```
//@version=6  
indicator("Friday session")  
  
//@variable The day of week, based on the current `time_tradingday` value.   
//          Uses "UTC+0" to return the daily session's timestamp at 00:00 UTC.   
int tradingDayOfWeek = dayofweek(time_tradingday, "UTC+0")  
  
//@variable Returns `true` if the `dayofweek` represents Friday, in exchange time.  
//          It might never return `true` on overnight symbols, depending on the timeframe, since the Friday session  
//          starts on Thursday.  
bool isFriday = dayofweek == dayofweek.friday  
//@variable Returns `true` if the `tradingDayOfWeek` is Friday.   
//          Differs from `isFriday` on symbols with overnight sessions and for timeframes > "1D" on others.  
bool isFridaySession = tradingDayOfWeek == dayofweek.friday  
  
// Create a horizontal line at the `dayofweek.friday` value.  
hline(dayofweek.friday, "Friday value", color.gray, hline.style_dashed, 2)  
// Plot the `dayofweek` and `tradingDayOfWeek` for comparison.  
plot(dayofweek, "Day of week", color.blue, 2)  
plot(tradingDayOfWeek, "Trading day", color.teal, 3)  
// Highlight the background when `isFriday` and `isFridaySession` occur.  
bgcolor(isFriday ? color.new(color.blue, 90) : na, title = "isFriday highlight")  
bgcolor(isFridaySession ? color.new(color.teal, 80) : na, title = "isFridaySession highlight")
```

Remarks

This variable is helpful when working with overnight sessions, where the day's session can begin on the previous calendar day. For example, on the "FXCM:EURUSD" symbol, the Monday session starts on Sunday, 17:00, exchange time. Unlike `time`, which returns the timestamp for Sunday at 17:00 on the Monday daily bar, `time_tradingday` returns the timestamp for Monday at 00:00 UTC. When used on timeframes higher than "1D", `time_tradingday` returns the timestamp of the last trading day inside that bar (e.g., on "1W", it returns the timestamp of the final trading day within the week).

See also

[time](#var_time)[time\_close](#var_time_close)
