### syminfo.ticker()

2 overloads

Returns `symbol` name without exchange prefix, e.g. "AAPL".

Syntax & Overloads

[```
syminfo.ticker(symbol) → simple string
```](#fun_syminfo.ticker-0)[```
syminfo.ticker(symbol) → series string
```](#fun_syminfo.ticker-1)

Arguments

symbol (simple string) Symbol. Note that the symbol should be passed with a prefix. For example: "NASDAQ:AAPL" instead of "AAPL".

Example

```
//@version=6  
indicator("syminfo.ticker fun", overlay=true)  
i_sym = input.symbol("NASDAQ:AAPL")  
pref = syminfo.prefix(i_sym)  
tick = syminfo.ticker(i_sym)  
t = ticker.new(pref, tick, session.extended)  
s = request.security(t, "1D", close)  
plot(s)
```

Returns

Returns `symbol` name without exchange prefix, e.g. "AAPL".

Remarks

The result of the function is used in the [ticker.new](#fun_ticker.new)/[ticker.modify](#fun_ticker.modify) and [request.security](#fun_request.security).

See also

[syminfo.tickerid](#var_syminfo.tickerid)[syminfo.ticker](#var_syminfo.ticker)[syminfo.prefix](#var_syminfo.prefix)[syminfo.prefix](#fun_syminfo.prefix)[ticker.new](#fun_ticker.new)
