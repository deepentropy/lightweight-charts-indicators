### syminfo.minmove

Returns a whole number used to calculate the smallest increment between a symbol's price movements ([syminfo.mintick](#var_syminfo.mintick)). It is the numerator in the [syminfo.mintick](#var_syminfo.mintick) formula: `syminfo.minmove / syminfo.pricescale = syminfo.mintick`.

Type

simple int

See also

[ticker.new](#fun_ticker.new)[syminfo.ticker](#var_syminfo.ticker)[timeframe.period](#var_timeframe.period)[timeframe.multiplier](#var_timeframe.multiplier)[syminfo.root](#var_syminfo.root)
