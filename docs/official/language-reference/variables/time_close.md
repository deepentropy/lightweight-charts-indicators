### time\_close

The time of the current bar's close in UNIX format. It represents the number of milliseconds elapsed since 00:00:00 UTC, 1 January 1970. On tick charts and price-based charts such as Renko, line break, Kagi, point & figure, and range, this variable's series holds an [na](#var_na) timestamp for the latest realtime bar (because the future closing time is unpredictable), but valid timestamps for all previous bars.

Type

series int

See also

[time](#var_time)[timenow](#var_timenow)[year](#var_year)[month](#var_month)[weekofyear](#var_weekofyear)[dayofmonth](#var_dayofmonth)[dayofweek](#var_dayofweek)[hour](#var_hour)[minute](#var_minute)[second](#var_second)
