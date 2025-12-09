### weekofyear

The week number of the year, in the exchange time zone, calculated from the bar's opening UNIX timestamp.

Type

series int

Remarks

This variable always references the week number corresponding to the bar's opening time. Consequently, for symbols with overnight sessions (e.g., "EURUSD", where the "Monday" session starts on Sunday at 17:00 in exchange time), the value may represent a previous calendar week rather than the week of the session's primary trading day.

See also

[weekofyear](#fun_weekofyear)[dayofmonth](#var_dayofmonth)[dayofweek](#var_dayofweek)[time](#var_time)[year](#var_year)[month](#var_month)[hour](#var_hour)[minute](#var_minute)[second](#var_second)
