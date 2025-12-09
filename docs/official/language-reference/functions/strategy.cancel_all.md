### strategy.cancel\_all()

Cancels all pending or unfilled orders, regardless of their identifiers.

This command is most useful when working with price-based orders (e.g., [limit orders](https://www.tradingview.com/pine-script-docs/concepts/strategies/#limit-orders)). Calls to this command can also cancel [market orders](https://www.tradingview.com/pine-script-docs/concepts/strategies/#market-orders), but only if they execute on the same ticks as the order placement commands.

Syntax

```
strategy.cancel_all() → void
```

Example

```
//@version=6  
strategy(title = "Cancel all orders demo")  
conditionForBuy1 = open > high[1]  
if conditionForBuy1  
    strategy.entry("Long entry 1", strategy.long, 1, limit = low) // Enter long using a limit order if `conditionForBuy1` is `true`.  
conditionForBuy2 = conditionForBuy1 and open[1] > high[2]  
float lowest2 = ta.lowest(low, 2)  
if conditionForBuy2  
    strategy.entry("Long entry 2", strategy.long, 1, limit = lowest2) // Enter long using a limit order if `conditionForBuy2` is `true`.  
conditionForStopTrading = open < lowest2  
if conditionForStopTrading  
    strategy.cancel_all() // Cancel both limit orders if `conditionForStopTrading` is `true`.
```
