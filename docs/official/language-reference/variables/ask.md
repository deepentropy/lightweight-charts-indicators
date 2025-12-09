### ask

The ask price at the time of the current tick, which represents the lowest price an active seller will accept for the instrument at its current value. This information is available only on the "1T" timeframe. On other timeframes, the variable's value is [na](#var_na).

Type

series float

Remarks

If the bid/ask values change since the last tick but no new trades are made, these changes will not be reflected in the value of this variable. It is only updated on new ticks.

See also

[open](#var_open)[high](#var_high)[low](#var_low)[volume](#var_volume)[time](#fun_time)[hl2](#var_hl2)[hlc3](#var_hlc3)[hlcc4](#var_hlcc4)[ohlc4](#var_ohlc4)[bid](#var_bid)
