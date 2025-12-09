### dayofweek

The day number of the week, in the exchange time zone, calculated from the bar's opening UNIX timestamp.

Type

series int

Remarks

This variable always references the day number corresponding to the bar's opening time. Consequently, for symbols with overnight sessions (e.g., "EURUSD", where the "Monday" session starts on Sunday at 17:00 in exchange time), the value may represent a day from the previous week rather than the session's primary trading day.

You can use [dayofweek.sunday](#const_dayofweek.sunday), [dayofweek.monday](#const_dayofweek.monday), [dayofweek.tuesday](#const_dayofweek.tuesday), [dayofweek.wednesday](#const_dayofweek.wednesday), [dayofweek.thursday](#const_dayofweek.thursday), [dayofweek.friday](#const_dayofweek.friday) and [dayofweek.saturday](#const_dayofweek.saturday) variables for comparisons.

See also

[dayofweek](#fun_dayofweek)[time](#var_time)[year](#var_year)[month](#var_month)[weekofyear](#var_weekofyear)[dayofmonth](#var_dayofmonth)[hour](#var_hour)[minute](#var_minute)[second](#var_second)
