### ticker.new()

2 overloads

Creates a ticker identifier for requesting additional data for the script.

Syntax & Overloads

[```
ticker.new(prefix, ticker, session, adjustment, backadjustment, settlement_as_close) → simple string
```](#fun_ticker.new-0)[```
ticker.new(prefix, ticker, session, adjustment, backadjustment, settlement_as_close) → series string
```](#fun_ticker.new-1)

Arguments

prefix (simple string) Exchange prefix. For example: 'BATS', 'NYSE', 'NASDAQ'. Exchange prefix of main series is [syminfo.prefix](#var_syminfo.prefix).

ticker (simple string) Ticker name. For example 'AAPL', 'MSFT', 'EURUSD'. Ticker name of the main series is [syminfo.ticker](#var_syminfo.ticker).

session (simple string) Session type. Optional argument. Possible values: [session.regular](#const_session.regular), [session.extended](#const_session.extended). Session type of the current chart is [syminfo.session](#var_syminfo.session). If session is not given, then [syminfo.session](#var_syminfo.session) value is used.

adjustment (simple string) Adjustment type. Optional argument. Possible values: [adjustment.none](#const_adjustment.none), [adjustment.splits](#const_adjustment.splits), [adjustment.dividends](#const_adjustment.dividends). If adjustment is not given, then default adjustment value is used (can be different depending on particular instrument).

backadjustment (simple backadjustment) Specifies whether past contract data on continuous futures symbols is back-adjusted. This setting only affects the data from symbols with this option available on their charts. Optional. The default is [backadjustment.inherit](#var_backadjustment.inherit), meaning that the new ticker ID inherits the symbol's default setting. Possible values: [backadjustment.inherit](#var_backadjustment.inherit), [backadjustment.on](#var_backadjustment.on), [backadjustment.off](#var_backadjustment.off).

settlement\_as\_close (simple settlement) Specifies whether a futures symbol's [close](#var_close) value represents the actual closing price or the settlement price on "1D" and higher timeframes. This setting only affects the data from symbols with this option available on their charts. Optional. The default is [settlement\_as\_close.inherit](#var_settlement_as_close.inherit), meaning that the new ticker ID inherits the chart symbol's default setting. Possible values: [settlement\_as\_close.inherit](#var_settlement_as_close.inherit), [settlement\_as\_close.on](#var_settlement_as_close.on), [settlement\_as\_close.off](#var_settlement_as_close.off).

Example

```
//@version=6  
indicator("ticker.new", overlay=true)  
t = ticker.new(syminfo.prefix, syminfo.ticker, session.regular, adjustment.splits)  
t2 = ticker.heikinashi(t)  
c = request.security(t2, timeframe.period, low, barmerge.gaps_on)  
plot(c, style=plot.style_linebr)
```

Returns

String value of ticker id, that can be supplied to [request.security](#fun_request.security) function.

Remarks

You may use return value of [ticker.new](#fun_ticker.new) function as input argument for [ticker.heikinashi](#fun_ticker.heikinashi), [ticker.renko](#fun_ticker.renko), [ticker.linebreak](#fun_ticker.linebreak), [ticker.kagi](#fun_ticker.kagi), [ticker.pointfigure](#fun_ticker.pointfigure) functions.

See also

[syminfo.tickerid](#var_syminfo.tickerid)[syminfo.ticker](#var_syminfo.ticker)[syminfo.session](#var_syminfo.session)[session.extended](#const_session.extended)[session.regular](#const_session.regular)[ticker.heikinashi](#fun_ticker.heikinashi)[adjustment.none](#var_adjustment.none)[adjustment.splits](#var_adjustment.splits)[adjustment.dividends](#var_adjustment.dividends)[backadjustment.inherit](#const_backadjustment.inherit)[backadjustment.on](#const_backadjustment.on)[backadjustment.off](#const_backadjustment.off)[settlement\_as\_close.inherit](#const_settlement_as_close.inherit)[settlement\_as\_close.on](#const_settlement_as_close.on)[settlement\_as\_close.off](#const_settlement_as_close.off)
