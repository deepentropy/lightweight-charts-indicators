### ticker.linebreak()

2 overloads

Creates a ticker identifier for requesting Line Break values.

Syntax & Overloads

[```
ticker.linebreak(symbol, number_of_lines) → simple string
```](#fun_ticker.linebreak-0)[```
ticker.linebreak(symbol, number_of_lines) → series string
```](#fun_ticker.linebreak-1)

Arguments

symbol (simple string) Symbol ticker identifier.

number\_of\_lines (simple int) Number of line.

Example

```
//@version=6  
indicator("ticker.linebreak", overlay=true)  
linebreak_tickerid = ticker.linebreak(syminfo.tickerid, 3)  
linebreak_close = request.security(linebreak_tickerid, timeframe.period, close)  
plot(linebreak_close)
```

Returns

String value of ticker id, that can be supplied to [request.security](#fun_request.security) function.

See also

[syminfo.tickerid](#var_syminfo.tickerid)[syminfo.ticker](#var_syminfo.ticker)[request.security](#fun_request.security)[ticker.heikinashi](#fun_ticker.heikinashi)[ticker.renko](#fun_ticker.renko)[ticker.kagi](#fun_ticker.kagi)[ticker.pointfigure](#fun_ticker.pointfigure)
