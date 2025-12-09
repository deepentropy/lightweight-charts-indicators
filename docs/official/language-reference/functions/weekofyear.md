### weekofyear()

Calculates the week number of the year, in a specified time zone, from a UNIX timestamp.

Syntax

```
weekofyear(time, timezone) → series int
```

Arguments

time (series int) A UNIX timestamp in milliseconds.

timezone (series string) Optional. Specifies the time zone of the returned week number. The value can be a time zone string in UTC/GMT offset notation (e.g., "UTC-5") or IANA time zone database notation (e.g., "America/New\_York"). The default is [syminfo.timezone](#var_syminfo.timezone).

Returns

The calculated week number, expressed in the specified time zone.

Remarks

A [UNIX timestamp](https://www.tradingview.com/pine-script-docs/concepts/time/#unix-timestamps) represents the number of milliseconds elapsed since 00:00 UTC on 1970-01-01. The meaning of a UNIX timestamp does not change relative to any time zone.

See also

[weekofyear](#var_weekofyear)[dayofmonth](#fun_dayofmonth)[dayofweek](#fun_dayofweek)[time](#fun_time)[year](#fun_year)[month](#fun_month)[hour](#fun_hour)[minute](#fun_minute)[second](#fun_second)
