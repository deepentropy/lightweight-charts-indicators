### ticker.pointfigure()

2 overloads

Creates a ticker identifier for requesting Point & Figure values.

Syntax & Overloads

[```
ticker.pointfigure(symbol, source, style, param, reversal) → simple string
```](#fun_ticker.pointfigure-0)[```
ticker.pointfigure(symbol, source, style, param, reversal) → series string
```](#fun_ticker.pointfigure-1)

Arguments

symbol (simple string) Symbol ticker identifier.

source (simple string) The source for calculating Point & Figure. Possible values are: 'hl', 'close'.

style (simple string) Specifies the ticker's box size assignment method. Possible values: "ATR" for Average True Range sizing, "Traditional" to use a fixed size, or "PercentageLTP" to use a percentage of the last trading price.

param (simple int/float) Represents the ticker's "ATR length" value if the `style` value is "ATR", "Box size" value if the `style` is "Traditional", or "Percentage" value if the `style` is "PercentageLTP".

reversal (simple int) Reversal amount.

Example

```
//@version=6  
indicator("ticker.pointfigure", overlay=true)  
pnf_tickerid = ticker.pointfigure(syminfo.tickerid, "hl", "Traditional", 1, 3)  
pnf_close = request.security(pnf_tickerid, timeframe.period, close)  
plot(pnf_close)
```

Returns

String value of ticker id, that can be supplied to [request.security](#fun_request.security) function.

See also

[syminfo.tickerid](#var_syminfo.tickerid)[syminfo.ticker](#var_syminfo.ticker)[request.security](#fun_request.security)[ticker.heikinashi](#fun_ticker.heikinashi)[ticker.renko](#fun_ticker.renko)[ticker.linebreak](#fun_ticker.linebreak)[ticker.kagi](#fun_ticker.kagi)
