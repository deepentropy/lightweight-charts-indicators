### hour()

Syntax

```
hour(time, timezone) → series int
```

Arguments

time (series int) UNIX time in milliseconds.

timezone (series string) Allows adjusting the returned value to a time zone specified in either UTC/GMT notation (e.g., "UTC-5", "GMT+0530") or as an IANA time zone database name (e.g., "America/New\_York"). Optional. The default is [syminfo.timezone](#var_syminfo.timezone).

Returns

Hour (in exchange timezone) for provided UNIX time.

Remarks

UNIX time is the number of milliseconds that have elapsed since 00:00:00 UTC, 1 January 1970.

See also

[hour](#var_hour)[time](#fun_time)[year](#fun_year)[month](#fun_month)[dayofmonth](#fun_dayofmonth)[dayofweek](#fun_dayofweek)[minute](#fun_minute)[second](#fun_second)
