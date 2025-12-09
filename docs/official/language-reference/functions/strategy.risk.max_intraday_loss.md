### strategy.risk.max\_intraday\_loss()

The maximum loss value allowed during a day. It is specified either in money (base currency), or in percentage of maximum intraday equity (0 -100).

Syntax

```
strategy.risk.max_intraday_loss(value, type, alert_message) → void
```

Arguments

value (simple int/float) A required parameter. The maximum loss value. It is specified either in money (base currency), or in percentage of maximum intraday equity. For % of equity the range of allowed values is from 0 to 100.

type (simple string) A required parameter. The type of the value. Please specify one of the following values: [strategy.percent\_of\_equity](#const_strategy.percent_of_equity) or [strategy.cash](#const_strategy.cash). Note: if equity drops down to zero or to a negative and the [strategy.percent\_of\_equity](#const_strategy.percent_of_equity) is specified, all pending orders are cancelled, all open positions are closed and no new orders can be placed for good.

alert\_message (simple string) An optional parameter which replaces the {{strategy.order.alert\_message}} placeholder when it is used in the "Create Alert" dialog box's "Message" field.

Example

```
// Sets the maximum intraday loss using the strategy's equity value.  
//@version=6  
strategy("strategy.risk.max_intraday_loss Example 1", overlay = false, default_qty_type = strategy.percent_of_equity, default_qty_value = 100)  
  
// Input for maximum intraday loss %.  
lossPct = input.float(10)  
  
// Set maximum intraday loss to our lossPct input  
strategy.risk.max_intraday_loss(lossPct, strategy.percent_of_equity)  
  
// Enter Short at bar_index zero.  
if bar_index == 0  
    strategy.entry("Short", strategy.short)  
  
// Store equity value from the beginning of the day  
eqFromDayStart = ta.valuewhen(ta.change(dayofweek) > 0, strategy.equity, 0)  
  
// Calculate change of the current equity from the beginning of the current day.  
eqChgPct = 100 * ((strategy.equity - eqFromDayStart) / strategy.equity)  
  
// Plot it  
plot(eqChgPct)  
hline(-lossPct)
```

Example

```
// Sets the maximum intraday loss using the strategy's cash value.  
//@version=6  
strategy("strategy.risk.max_intraday_loss Example 2", overlay = false)  
  
// Input for maximum intraday loss in absolute cash value of the symbol.  
absCashLoss = input.float(5)  
  
// Set maximum intraday loss to `absCashLoss` in account currency.  
strategy.risk.max_intraday_loss(absCashLoss, strategy.cash)  
  
// Enter Short at bar_index zero.  
if bar_index == 0  
    strategy.entry("Short", strategy.short)  
  
// Store the open price value from the beginning of the day.  
beginPrice = ta.valuewhen(ta.change(dayofweek) > 0, open, 0)  
  
// Calculate the absolute price change for the current period.  
priceChg = (close - beginPrice)  
  
hline(absCashLoss)  
plot(priceChg)
```

See also

[strategy](#fun_strategy)[strategy.percent\_of\_equity](#const_strategy.percent_of_equity)[strategy.cash](#const_strategy.cash)
