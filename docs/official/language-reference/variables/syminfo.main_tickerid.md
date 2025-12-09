### syminfo.main\_tickerid

A ticker identifier representing the current chart's symbol. The value contains an exchange prefix and a symbol name, separated by a colon (e.g., "NASDAQ:AAPL"). It can also include information about data modifications such as dividend adjustment, non-standard chart type, currency conversion, etc. Unlike [syminfo.tickerid](#var_syminfo.tickerid), this variable's value does not change when used in the `expression` argument of a `request.*()` function call.

Type

simple string

See also

[ticker.new](#fun_ticker.new)[timeframe.main\_period](#var_timeframe.main_period)[syminfo.tickerid](#var_syminfo.tickerid)[syminfo.ticker](#var_syminfo.ticker)[timeframe.period](#var_timeframe.period)[timeframe.multiplier](#var_timeframe.multiplier)[syminfo.root](#var_syminfo.root)
