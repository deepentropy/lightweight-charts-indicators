### dayofmonth

The day number of the month, in the exchange time zone, calculated from the bar's opening UNIX timestamp.

Type

series int

Remarks

This variable always references the day number corresponding to the bar's opening time. Consequently, for symbols with overnight sessions (e.g., "EURUSD", where the "Monday" session starts on Sunday at 17:00 in exchange time), the value may represent a day from the previous week rather than the session's primary trading day.

See also

[dayofmonth](#fun_dayofmonth)[dayofweek](#var_dayofweek)[weekofyear](#var_weekofyear)[time](#var_time)[year](#var_year)[month](#var_month)[hour](#var_hour)[minute](#var_minute)[second](#var_second)
