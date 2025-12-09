### strategy.cancel()

Cancels a pending or unfilled order with a specific identifier. If multiple unfilled orders share the same ID, calling this command with that ID as the `id` argument cancels all of them. If a script calls this command with an `id` representing the ID of a filled order, it has no effect.

This command is most useful when working with price-based orders (e.g., [limit orders](https://www.tradingview.com/pine-script-docs/concepts/strategies/#limit-orders)). Calls to this command can also cancel [market orders](https://www.tradingview.com/pine-script-docs/concepts/strategies/#market-orders), but only if they execute on the same ticks as the order placement commands.

Syntax

```
strategy.cancel(id) → void
```

Arguments

id (series string) The identifier of the unfilled order to cancel.

Example

```
//@version=6  
strategy(title = "Order cancellation demo")  
  
conditionForBuy = open > high[1]  
if conditionForBuy  
    strategy.entry("Long", strategy.long, 1, limit = low) // Enter long using limit order at low price of current bar if `conditionForBuy` is `true`.  
if not conditionForBuy  
    strategy.cancel("Long") // Cancel the entry order with name "Long" if `conditionForBuy` is `false`.
```
