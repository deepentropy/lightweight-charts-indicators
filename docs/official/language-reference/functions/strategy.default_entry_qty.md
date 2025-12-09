### strategy.default\_entry\_qty()

Calculates the default quantity, in units, of an entry order from [strategy.entry](#fun_strategy.entry) or [strategy.order](#fun_strategy.order) if it were to fill at the specified `fill_price` value. The calculation depends on several strategy properties, including `default_qty_type`, `default_qty_value`, `currency`, and other parameters in the [strategy](#fun_strategy) function and their representation in the "Properties" tab of the strategy's settings.

Syntax

```
strategy.default_entry_qty(fill_price) → series float
```

Arguments

fill\_price (series int/float) The fill price for which to calculate the default order quantity.

Example

```
//@version=6  
strategy("Supertrend Strategy", overlay = true, default_qty_type = strategy.percent_of_equity, default_qty_value = 15)  
  
//@variable The length of the ATR calculation.  
atrPeriod = input(10, "ATR Length")  
//@variable The ATR multiplier.  
factor = input.float(3.0, "Factor", step = 0.01)  
//@variable The tick offset of the stop order.  
stopOffsetInput = input.int(100, "Tick offset for entry stop")  
  
// Get the direction of the SuperTrend.  
[_, direction] = ta.supertrend(factor, atrPeriod)  
  
if ta.change(direction) < 0  
    //@variable The stop price of the entry order.  
    stopPrice = close + syminfo.mintick * stopOffsetInput  
    //@variable The expected default fill quantity at the `stopPrice`. This value may not reflect actual qty of the filled order, because fill price may be different.  
    calculatedQty = strategy.default_entry_qty(stopPrice)  
    strategy.entry("My Long Entry Id", strategy.long, stop = stopPrice)  
    label.new(bar_index, stopPrice, str.format("Stop set at {0}\nExpected qty at {0}: {1}", math.round_to_mintick(stopPrice), calculatedQty))  
  
if ta.change(direction) > 0  
    strategy.close_all()
```

Remarks

This function does not consider open positions simulated by a strategy. For example, if a strategy script has an open position from a long order with a `qty` of 10 units, using the [strategy.entry](#fun_strategy.entry) function to simulate a short order with a `qty` of 5 will prompt the script to sell 15 units to reverse the position. This function will still return 5 in such a case since it doesn't consider an open trade.

This value represents the default calculated quantity of an order.

Order placement commands can override the default value by explicitly passing a new `qty` value in the function call.
