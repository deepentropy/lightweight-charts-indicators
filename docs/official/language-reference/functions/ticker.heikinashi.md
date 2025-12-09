### ticker.heikinashi()

2 overloads

Creates a ticker identifier for requesting Heikin Ashi bar values.

Syntax & Overloads

[```
ticker.heikinashi(symbol) → simple string
```](#fun_ticker.heikinashi-0)[```
ticker.heikinashi(symbol) → series string
```](#fun_ticker.heikinashi-1)

Arguments

symbol (simple string) Symbol ticker identifier.

Example

```
//@version=6  
indicator("ticker.heikinashi", overlay=true)  
heikinashi_close = request.security(ticker.heikinashi(syminfo.tickerid), timeframe.period, close)  
  
heikinashi_aapl_60_close = request.security(ticker.heikinashi("AAPL"), "60", close)  
plot(heikinashi_close)  
plot(heikinashi_aapl_60_close)
```

Returns

String value of ticker id, that can be supplied to [request.security](#fun_request.security) function.

See also

[syminfo.tickerid](#var_syminfo.tickerid)[syminfo.ticker](#var_syminfo.ticker)[request.security](#fun_request.security)[ticker.renko](#fun_ticker.renko)[ticker.linebreak](#fun_ticker.linebreak)[ticker.kagi](#fun_ticker.kagi)[ticker.pointfigure](#fun_ticker.pointfigure)
