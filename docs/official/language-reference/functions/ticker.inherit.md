### ticker.inherit()

2 overloads

Constructs a ticker ID for the specified `symbol` with additional parameters inherited from the ticker ID passed into the function call, allowing the script to request a symbol's data using the same modifiers that the `from_tickerid` has, including extended session, dividend adjustment, currency conversion, non-standard chart types, back-adjustment, settlement-as-close, etc.

Syntax & Overloads

[```
ticker.inherit(from_tickerid, symbol) → simple string
```](#fun_ticker.inherit-0)[```
ticker.inherit(from_tickerid, symbol) → series string
```](#fun_ticker.inherit-1)

Arguments

from\_tickerid (simple string) The ticker ID to inherit modifiers from.

symbol (simple string) The symbol to construct the new ticker ID for.

Example

```
//@version=6  
indicator("ticker.inherit")  
  
//@variable A "NASDAQ:AAPL" ticker ID with Extender Hours enabled.  
tickerExtHours = ticker.new("NASDAQ", "AAPL", session.extended)  
//@variable A Heikin Ashi ticker ID for "NASDAQ:AAPL" with Extended Hours enabled.  
HAtickerExtHours = ticker.heikinashi(tickerExtHours)  
//@variable The "NASDAQ:MSFT" symbol with no modifiers.  
testSymbol = "NASDAQ:MSFT"  
//@variable A ticker ID for "NASDAQ:MSFT" with inherited Heikin Ashi and Extended Hours modifiers.  
testSymbolHAtickerExtHours = ticker.inherit(HAtickerExtHours, testSymbol)  
  
//@variable The `close` price requested using "NASDAQ:MSFT" with inherited modifiers.  
secData = request.security(testSymbolHAtickerExtHours, "60", close, ignore_invalid_symbol = true)  
//@variable The `close` price requested using "NASDAQ:MSFT" without modifiers.  
compareData = request.security(testSymbol, "60", close, ignore_invalid_symbol = true)  
  
plot(secData, color = color.green)  
plot(compareData)
```

Remarks

If the constructed ticker ID inherits a modifier that doesn't apply to the symbol (e.g., if the `from_tickerid` has Extended Hours enabled, but no such option is available for the `symbol`), the script will ignore the modifier when requesting data using the ID.
