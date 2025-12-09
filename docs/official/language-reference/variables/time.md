### time

Current bar time in UNIX format. It is the number of milliseconds that have elapsed since 00:00:00 UTC, 1 January 1970.

Type

series int

Remarks

Note that this variable returns the timestamp based on the time of the bar's open. Because of that, for overnight sessions (e.g. EURUSD, where Monday session starts on Sunday, 17:00) this variable can return time before the specified date of the trading day. For example, on EURUSD, `dayofmonth(time)` can be lower by 1 than the date of the trading day, because the bar for the current day actually opens one day prior.

See also

[time](#fun_time)[time\_close](#var_time_close)[timenow](#var_timenow)[year](#var_year)[month](#var_month)[weekofyear](#var_weekofyear)[dayofmonth](#var_dayofmonth)[dayofweek](#var_dayofweek)[hour](#var_hour)[minute](#var_minute)[second](#var_second)
