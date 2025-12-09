### request.seed()

Requests the result of an expression evaluated on data from a user-maintained GitHub repository. \*\*Note:\*\*The creation of new Pine Seeds repositories is suspended; only existing repositories are currently supported. See the [Pine Seeds documentation](https://github.com/tradingview-eod/pine-seeds-docs) on GitHub to learn more.

Syntax

```
request.seed(source, symbol, expression, ignore_invalid_symbol, calc_bars_count) → series <type>
```

Arguments

source (series string) Name of the GitHub repository.

symbol (series string) Name of the file in the GitHub repository containing the data. The ".csv" file extension must not be included.

expression (<arg\_expr\_type>) An expression to be calculated and returned from the requested symbol's context. It can be a built-in variable like [close](#var_close), an expression such as `ta.sma(close, 100)`, a non-mutable variable previously calculated in the script, a function call that does not use Pine Script® drawings, an array, a matrix, or a tuple. Mutable variables are not allowed, unless they are enclosed in the body of a function used in the expression.

ignore\_invalid\_symbol (input bool) Determines the behavior of the function if the specified symbol is not found: if [false](#const_false), the script will halt and throw a runtime error; if [true](#const_true), the function will return [na](#var_na) and execution will continue. Optional. The default is [false](#const_false).

calc\_bars\_count (simple int) Optional. If specified, the function requests only this number of values from the end of the symbol's history and calculates `expression` as if these values are the only available data, which might improve calculation speed in some cases. The default is 100,000. For information about the bar limits for different TradingView plans, see the [Chart bars](https://www.tradingview.com/pine-script-docs/writing/limitations/#chart-bars) section of the [Limitations](https://www.tradingview.com/pine-script-docs/writing/limitations/) page in the User Manual.

Example

```
//@version=6  
indicator("BTC Development Activity")  
  
[devAct, devActSMA] = request.seed("seed_crypto_santiment", "BTC_DEV_ACTIVITY", [close, ta.sma(close, 10)])  
  
plot(devAct, "BTC Development Activity")  
plot(devActSMA, "BTC Development Activity SMA10", color = color.yellow)
```

Returns

Requested series or tuple of series, which may include array/matrix IDs.
