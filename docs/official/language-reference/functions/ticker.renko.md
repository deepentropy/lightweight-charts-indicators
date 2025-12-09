### ticker.renko()

2 overloads

Creates a ticker identifier for requesting Renko values.

Syntax & Overloads

[```
ticker.renko(symbol, style, param, request_wicks, source) → simple string
```](#fun_ticker.renko-0)[```
ticker.renko(symbol, style, param, request_wicks, source) → series string
```](#fun_ticker.renko-1)

Arguments

symbol (simple string) Symbol ticker identifier.

style (simple string) Specifies the ticker's box size assignment method. Possible values: "ATR" for Average True Range sizing, "Traditional" to use a fixed size, or "PercentageLTP" to use a percentage of the last trading price.

param (simple int/float) Represents the ticker's "ATR length" value if the `style` value is "ATR", "Box size" value if the `style` is "Traditional", or "Percentage" value if the `style` is "PercentageLTP".

request\_wicks (simple bool) Specifies if wick values are returned for Renko bricks. When [true](#const_true), [high](#var_high) and [low](#var_low) values requested from a symbol using the ticker formed by this function will include wick values when they are present. When [false](#const_false), [high](#var_high) and [low](#var_low) will always be equal to either [open](#var_open) or [close](#var_close). Optional. The default is [false](#const_false). A detailed explanation of how Renko wicks are calculated can be found in our [Help Center](https://www.tradingview.com/support/solutions/43000481040-what-do-renko-wicks-mean/).

source (simple string) The source used to calculate bricks. Optional. Possible values: "Close", "OHLC". The default is "Close".

Example

```
//@version=6  
indicator("ticker.renko", overlay=true)  
renko_tickerid = ticker.renko(syminfo.tickerid, "ATR", 10)  
renko_close = request.security(renko_tickerid, timeframe.period, close)  
plot(renko_close)
```

Example

```
//@version=6  
indicator("Renko candles", overlay=false)  
renko_tickerid = ticker.renko(syminfo.tickerid, "ATR", 10)  
[renko_open, renko_high, renko_low, renko_close] = request.security(renko_tickerid, timeframe.period, [open, high, low, close])  
plotcandle(renko_open, renko_high, renko_low, renko_close, color = renko_close > renko_open ? color.green : color.red)
```

Returns

String value of ticker id, that can be supplied to [request.security](#fun_request.security) function.

See also

[syminfo.tickerid](#var_syminfo.tickerid)[syminfo.ticker](#var_syminfo.ticker)[request.security](#fun_request.security)[ticker.heikinashi](#fun_ticker.heikinashi)[ticker.linebreak](#fun_ticker.linebreak)[ticker.kagi](#fun_ticker.kagi)[ticker.pointfigure](#fun_ticker.pointfigure)
