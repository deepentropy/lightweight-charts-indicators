### ticker.modify()

2 overloads

Creates a ticker identifier for requesting additional data for the script.

Syntax & Overloads

[```
ticker.modify(tickerid, session, adjustment, backadjustment, settlement_as_close) → simple string
```](#fun_ticker.modify-0)[```
ticker.modify(tickerid, session, adjustment, backadjustment, settlement_as_close) → series string
```](#fun_ticker.modify-1)

Arguments

tickerid (simple string) Symbol name with exchange prefix, e.g. 'BATS:MSFT', 'NASDAQ:MSFT' or tickerid with session and adjustment from the [ticker.new](#fun_ticker.new) function.

session (simple string) Session type. Optional argument. Possible values: [session.regular](#const_session.regular), [session.extended](#const_session.extended). Session type of the current chart is [syminfo.session](#var_syminfo.session). If session is not given, then [syminfo.session](#var_syminfo.session) value is used.

adjustment (simple string) Adjustment type. Optional argument. Possible values: [adjustment.none](#const_adjustment.none), [adjustment.splits](#const_adjustment.splits), [adjustment.dividends](#const_adjustment.dividends). If adjustment is not given, then default adjustment value is used (can be different depending on particular instrument).

backadjustment (simple backadjustment) Specifies whether past contract data on continuous futures symbols is back-adjusted. This setting only affects the data from symbols with this option available on their charts. Optional. The default is [backadjustment.inherit](#var_backadjustment.inherit), meaning that the modified ticker ID inherits the setting from the ticker ID passed to the `tickerid` parameter, or it inherits the symbol's default if the `tickerid` does not specify this setting. Possible values: [backadjustment.inherit](#var_backadjustment.inherit), [backadjustment.on](#var_backadjustment.on), [backadjustment.off](#var_backadjustment.off).

settlement\_as\_close (simple settlement) Specifies whether a futures symbol's [close](#var_close) value represents the actual closing price or the settlement price on "1D" and higher timeframes. This setting only affects the data from symbols with this option available on their charts. Optional. The default is [settlement\_as\_close.inherit](#var_settlement_as_close.inherit), meaning that the modified ticker ID inherits the setting from the `tickerid` passed into the function, or it inherits the chart symbol's default if the `tickerid` does not specify this setting. Possible values: [settlement\_as\_close.inherit](#var_settlement_as_close.inherit), [settlement\_as\_close.on](#var_settlement_as_close.on), [settlement\_as\_close.off](#var_settlement_as_close.off).

Example

```
//@version=6  
indicator("ticker_modify", overlay=true)  
t1 = ticker.new(syminfo.prefix, syminfo.ticker, session.regular, adjustment.splits)  
c1 = request.security(t1, "D", close)  
t2 = ticker.modify(t1, session.extended)  
c2 = request.security(t2, "2D", close)  
plot(c1)  
plot(c2)
```

Returns

String value of ticker id, that can be supplied to [request.security](#fun_request.security) function.

See also

[syminfo.tickerid](#var_syminfo.tickerid)[syminfo.ticker](#var_syminfo.ticker)[syminfo.session](#var_syminfo.session)[session.extended](#const_session.extended)[session.regular](#const_session.regular)[ticker.heikinashi](#fun_ticker.heikinashi)[adjustment.none](#const_adjustment.none)[adjustment.splits](#const_adjustment.splits)[adjustment.dividends](#const_adjustment.dividends)[backadjustment.inherit](#const_backadjustment.inherit)[backadjustment.on](#const_backadjustment.on)[backadjustment.off](#const_backadjustment.off)[settlement\_as\_close.inherit](#const_settlement_as_close.inherit)[settlement\_as\_close.on](#const_settlement_as_close.on)[settlement\_as\_close.off](#const_settlement_as_close.off)
