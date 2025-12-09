### syminfo.tickerid

A ticker identifier representing the chart's symbol or a requested symbol, depending on how the script uses it. The variable's value represents a requested dataset's ticker ID when used in the `expression` argument of a `request.*()` function call. Otherwise, it represents the chart's ticker ID. The value contains an exchange prefix and a symbol name, separated by a colon (e.g., "NASDAQ:AAPL"). It can also include information about data modifications such as dividend adjustment, non-standard chart type, currency conversion, etc.

Type

simple string

Remarks

Because the value of this variable does not always use a simple "prefix:ticker" format, it is a poor candidate for use in boolean comparisons or string manipulation functions. In those contexts, run the variable's result through [ticker.standard](#fun_ticker.standard) to purify it. This will remove any extraneous information and return a ticker ID consistently formatted using the "prefix:ticker" structure.

To always access the script's main ticker ID, even within another context, use the [syminfo.main\_tickerid](#var_syminfo.main_tickerid) variable.

See also

[ticker.new](#fun_ticker.new)[syminfo.main\_tickerid](#var_syminfo.main_tickerid)[timeframe.main\_period](#var_timeframe.main_period)[syminfo.ticker](#var_syminfo.ticker)[timeframe.period](#var_timeframe.period)[timeframe.multiplier](#var_timeframe.multiplier)[syminfo.root](#var_syminfo.root)
