### request.security\_lower\_tf()

Requests the results of an expression from a specified symbol on a timeframe lower than or equal to the chart's timeframe. It returns an [array](#type_array) containing one element for each lower-timeframe bar within the chart bar. On a 5-minute chart, requesting data using a `timeframe` argument of "1" typically returns an array with five elements representing the value of the `expression` on each 1-minute bar, ordered by time with the earliest value first.

Syntax

```
request.security_lower_tf(symbol, timeframe, expression, ignore_invalid_symbol, currency, ignore_invalid_timeframe, calc_bars_count) → array<type>
```

Arguments

symbol (series string) Symbol or ticker identifier of the requested data. Use an empty string or [syminfo.tickerid](#var_syminfo.tickerid) to request data using the chart's symbol. To retrieve data with additional modifiers (extended sessions, dividend adjustments, non-standard chart types like Heikin Ashi and Renko, etc.), create a custom ticker ID for the request using the functions in the `ticker.*` namespace.

timeframe (series string) Timeframe of the requested data. Use an empty string or [timeframe.period](#var_timeframe.period) to request data from the chart's timeframe or the `timeframe` specified in the [indicator](#fun_indicator) function. To request data from a different timeframe, supply a valid timeframe string. See [here](https://www.tradingview.com/pine-script-docs/concepts/timeframes/#timeframe-string-specifications) to learn about specifying timeframe strings.

expression (variable, object or function of series int/float/bool/string/color/enum, or a tuple of these) The expression to calculate and return from the requested context. It can accept a built-in variable like [close](#var_close), a user-defined variable, an expression such as `ta.change(close) / (high - low)`, a function call that does not use Pine Script® drawings, an [object](https://www.tradingview.com/pine-script-docs/language/objects/), or a tuple of expressions. [Collections](https://www.tradingview.com/pine-script-docs/language/type-system/#collections) are not allowed unless they are within the fields of an object

ignore\_invalid\_symbol (series bool) Determines the behavior of the function if the specified symbol is not found: if [false](#const_false), the script will halt and throw a runtime error; if [true](#const_true), the function will return [na](#var_na) and execution will continue. Optional. The default is [false](#const_false).

currency (series string) Optional. Specifies the target currency for converting values expressed in currency units (e.g., [open](#var_open), [high](#var_high), [low](#var_low), [close](#var_close)) or expressions involving such values. Literal values such as `200` are not converted. The conversion rate for monetary values depends on the previous daily value of a corresponding currency pair from the most popular exchange. A spread symbol is used if no exchange provides the rate directly. Possible values: a "string" representing a valid currency code (e.g., "USD" or "USDT") or a constant from the `currency.*` namespace (e.g., [currency.USD](#const_currency.USD) or [currency.USDT](#const_currency.USDT)). The default is [syminfo.currency](#var_syminfo.currency).

ignore\_invalid\_timeframe (series bool) Determines the behavior of the function when the chart's timeframe is smaller than the `timeframe` used in the function call. If [false](#const_false), the script will halt and throw a runtime error. If [true](#const_true), the function will return [na](#var_na) and execution will continue. Optional. The default is [false](#const_false).

calc\_bars\_count (simple int) Optional. Determines the maximum number of recent historical bars that the function can request. If specified, the function evaluates the `expression` argument starting from that number of bars behind the last historical bar in the requested dataset, treating those bars as the only available data. Limiting the number of historical bars in a request can help improve calculation efficiency in some cases. The default is 100,000 bars, which is the maximum number of bars that non-professional plans can request. See the [Intrabars](https://www.tradingview.com/pine-script-docs/writing/limitations/#chart-bars) section of the User Manual's [Limitations](https://www.tradingview.com/pine-script-docs/writing/limitations/) page to learn more about requested bar limits.

Example

```
//@version=6  
indicator("`request.security_lower_tf()` Example", overlay = true)  
  
// If the current chart timeframe is set to 120 minutes, then the `arrayClose` array will contain two 'close' values from the 60 minute timeframe for each bar.  
arrClose = request.security_lower_tf(syminfo.tickerid, "60", close)  
  
if bar_index == last_bar_index - 1  
    label.new(bar_index, high, str.tostring(arrClose))
```

Returns

An array of a type determined by `expression`, or a tuple of these.

Remarks

Scripts using this function might calculate differently on historical and realtime bars, leading to [repainting](https://www.tradingview.com/pine-script-docs/concepts/repainting/).

Please note that spreads (e.g., "AAPL+MSFT\*TSLA") do not always return reliable data with this function.

A single script can contain no more than 40 unique `request.*()` function calls. A call is unique only if it does not call the same function with the same arguments.

When using two calls to a `request.*()` function to evaluate the same expression from the same context with different `calc_bars_count` values, the second call requests the same number of historical bars as the first. For example, if a script calls `request.security("AAPL", "", close, calc_bars_count = 3)` after it calls `request.security("AAPL", "", close, calc_bars_count = 5)`, the second call also uses five bars of historical data, not three.

The symbol of a `request.()` call can be *inherited* if it is not specified precisely, i.e., if the `symbol` argument is an empty string or [syminfo.tickerid](#var_syminfo.tickerid). Similarly, the timeframe of a `request.()` call can be inherited if the `timeframe` argument is an empty string or [timeframe.period](#var_timeframe.period). These values are normally taken from the chart that the script is running on. However, if `request.*()` function A is called from within the expression of `request.*()` function B, then function A can inherit the values from function B. See [here](https://www.tradingview.com/pine-script-docs/concepts/other-timeframes-and-data/#nested-requests) for more information.

See also

[request.security](#fun_request.security)[syminfo.ticker](#var_syminfo.ticker)[syminfo.tickerid](#var_syminfo.tickerid)[timeframe.period](#var_timeframe.period)[ticker.new](#fun_ticker.new)[request.dividends](#fun_request.dividends)[request.earnings](#fun_request.earnings)[request.splits](#fun_request.splits)[request.financial](#fun_request.financial)
