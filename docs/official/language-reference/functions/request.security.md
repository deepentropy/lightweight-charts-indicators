### request.security()

Requests the result of an expression from a specified context (symbol and timeframe).

Syntax

```
request.security(symbol, timeframe, expression, gaps, lookahead, ignore_invalid_symbol, currency, calc_bars_count) → series <type>
```

Arguments

symbol (series string) Symbol or ticker identifier of the requested data. Use an empty string or [syminfo.tickerid](#var_syminfo.tickerid) to request data using the chart's symbol. To retrieve data with additional modifiers (extended sessions, dividend adjustments, non-standard chart types like Heikin Ashi and Renko, etc.), create a custom ticker ID for the request using the functions in the `ticker.*` namespace.

timeframe (series string) Timeframe of the requested data. Use an empty string or [timeframe.period](#var_timeframe.period) to request data from the chart's timeframe or the `timeframe` specified in the [indicator](#fun_indicator) function. To request data from a different timeframe, supply a valid timeframe string. See [here](https://www.tradingview.com/pine-script-docs/concepts/timeframes/#timeframe-string-specifications) to learn about specifying timeframe strings.

expression (variable, function, object, array, matrix, or map of series int/float/bool/string/color/enum, or a tuple of these) The expression to calculate and return from the requested context. It can accept a built-in variable like [close](#var_close), a user-defined variable, an expression such as `ta.change(close) / (high - low)`, a function call that does not use Pine Script® drawings, an [object](https://www.tradingview.com/pine-script-docs/language/objects/), a [collection](https://www.tradingview.com/pine-script-docs/language/type-system/#collections), or a tuple of expressions.

gaps (simple barmerge\_gaps) Specifies how the returned values are merged on chart bars. Possible values: [barmerge.gaps\_on](#const_barmerge.gaps_on), [barmerge.gaps\_off](#const_barmerge.gaps_off). With [barmerge.gaps\_on](#const_barmerge.gaps_on) a value only appears on the current chart bar when it first becomes available from the function's context, otherwise [na](#var_na) is returned (thus a "gap" occurs). With [barmerge.gaps\_off](#const_barmerge.gaps_off) what would otherwise be gaps are filled with the latest known value returned, avoiding [na](#var_na) values. Optional. The default is [barmerge.gaps\_off](#const_barmerge.gaps_off).

lookahead (simple barmerge\_lookahead) On historical bars only, returns data from the timeframe before it elapses. Possible values: [barmerge.lookahead\_on](#const_barmerge.lookahead_on), [barmerge.lookahead\_off](#const_barmerge.lookahead_off). Has no effect on realtime values. Optional. The default is [barmerge.lookahead\_off](#const_barmerge.lookahead_off) starting from Pine Script® v3. The default is [barmerge.lookahead\_on](#const_barmerge.lookahead_on) in v1 and v2. WARNING: Using [barmerge.lookahead\_on](#const_barmerge.lookahead_on) at timeframes higher than the chart's without offsetting the `expression` argument like in `close[1]` will introduce future leak in scripts, as the function will then return the `close` price before it is actually known in the current context. As is explained in the User Manual's page on [Repainting](https://www.tradingview.com/pine-script-docs/concepts/repainting/#future-leak-with-request-security) this will produce misleading results.

ignore\_invalid\_symbol (input bool) Determines the behavior of the function if the specified symbol is not found: if [false](#const_false), the script will halt and throw a runtime error; if [true](#const_true), the function will return [na](#var_na) and execution will continue. Optional. The default is [false](#const_false).

currency (series string) Optional. Specifies the target currency for converting values expressed in currency units (e.g., [open](#var_open), [high](#var_high), [low](#var_low), [close](#var_close)) or expressions involving such values. Literal values such as `200` are not converted. The conversion rate for monetary values depends on the previous daily value of a corresponding currency pair from the most popular exchange. A spread symbol is used if no exchange provides the rate directly. Possible values: a "string" representing a valid currency code (e.g., "USD" or "USDT") or a constant from the `currency.*` namespace (e.g., [currency.USD](#const_currency.USD) or [currency.USDT](#const_currency.USDT)). The default is [syminfo.currency](#var_syminfo.currency).

calc\_bars\_count (simple int) Optional. Determines the maximum number of recent historical bars that the function can request. If specified, the function evaluates the `expression` argument starting from that number of bars behind the last historical bar in the requested dataset, treating those bars as the only available data. Limiting the number of historical bars in a request can help improve calculation efficiency in some cases. The default is 100,000 bars, which is the maximum number of bars that non-professional plans can request. See the [Intrabars](https://www.tradingview.com/pine-script-docs/writing/limitations/#chart-bars) section of the User Manual's [Limitations](https://www.tradingview.com/pine-script-docs/writing/limitations/) page to learn more about requested bar limits.

Example

```
//@version=6  
indicator("Simple `request.security()` calls")  
// Returns 1D close of the current symbol.  
dailyClose = request.security(syminfo.tickerid, "1D", close)  
plot(dailyClose)  
  
// Returns the close of "AAPL" from the same timeframe as currently open on the chart.  
aaplClose = request.security("AAPL", timeframe.period, close)  
plot(aaplClose)
```

Example

```
//@version=6  
indicator("Advanced `request.security()` calls")  
// This calculates a 10-period moving average on the active chart.  
sma = ta.sma(close, 10)  
// This sends the `sma` calculation for execution in the context of the "AAPL" symbol at a "240" (4 hours) timeframe.  
aaplSma = request.security("AAPL", "240", sma)  
plot(aaplSma)  
  
// To avoid differences on historical and realtime bars, you can use this technique, which only returns a value from the higher timeframe on the bar after it completes:  
indexHighTF = barstate.isrealtime ? 1 : 0  
indexCurrTF = barstate.isrealtime ? 0 : 1  
nonRepaintingClose = request.security(syminfo.tickerid, "1D", close[indexHighTF])[indexCurrTF]  
plot(nonRepaintingClose, "Non-repainting close")  
  
// Returns the 1H close of "AAPL", extended session included. The value is dividend-adjusted.  
extendedTicker = ticker.modify("NASDAQ:AAPL", session = session.extended, adjustment = adjustment.dividends)  
aaplExtAdj = request.security(extendedTicker, "60", close)  
plot(aaplExtAdj)  
  
// Returns the result of a user-defined function.  
// The `max` variable is mutable, but we can pass it to `request.security()` because it is wrapped in a function.  
allTimeHigh(source) =>  
    var max = source  
    max := math.max(max, source)  
allTimeHigh1D = request.security(syminfo.tickerid, "1D", allTimeHigh(high))  
  
// By using a tuple `expression`, we obtain several values with only one `request.security()` call.  
[open1D, high1D, low1D, close1D, ema1D] = request.security(syminfo.tickerid, "1D", [open, high, low, close, ta.ema(close, 10)])  
plotcandle(open1D, high1D, low1D, close1D)  
plot(ema1D)  
  
// Returns an array containing the OHLC values of the chart's symbol from the 1D timeframe.  
ohlcArray = request.security(syminfo.tickerid, "1D", array.from(open, high, low, close))  
plotcandle(array.get(ohlcArray, 0), array.get(ohlcArray, 1), array.get(ohlcArray, 2), array.get(ohlcArray, 3))
```

Returns

A result determined by `expression`.

Remarks

Scripts using this function might calculate differently on historical and realtime bars, leading to [repainting](https://www.tradingview.com/pine-script-docs/concepts/repainting/).

A single script can contain no more than 40 unique `request.*()` function calls. A call is unique only if it does not call the same function with the same arguments.

When using two calls to a `request.*()` function to evaluate the same expression from the same context with different `calc_bars_count` values, the second call requests the same number of historical bars as the first. For example, if a script calls `request.security("AAPL", "", close, calc_bars_count = 3)` after it calls `request.security("AAPL", "", close, calc_bars_count = 5)`, the second call also uses five bars of historical data, not three.

The symbol of a `request.()` call can be *inherited* if it is not specified precisely, i.e., if the `symbol` argument is an empty string or [syminfo.tickerid](#var_syminfo.tickerid). Similarly, the timeframe of a `request.()` call can be inherited if the `timeframe` argument is an empty string or [timeframe.period](#var_timeframe.period). These values are normally taken from the chart on which the script is running. However, if `request.*()` function A is called from within the expression of `request.*()` function B, then function A can inherit the values from function B. See [here](https://www.tradingview.com/pine-script-docs/concepts/other-timeframes-and-data/#nested-requests) for more information.

See also

[syminfo.ticker](#var_syminfo.ticker)[syminfo.tickerid](#var_syminfo.tickerid)[timeframe.period](#var_timeframe.period)[ticker.new](#fun_ticker.new)[ticker.modify](#fun_ticker.modify)[request.security\_lower\_tf](#fun_request.security_lower_tf)[request.dividends](#fun_request.dividends)[request.earnings](#fun_request.earnings)[request.splits](#fun_request.splits)[request.financial](#fun_request.financial)
