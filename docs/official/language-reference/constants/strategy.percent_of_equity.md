### strategy.percent\_of\_equity

This is one of the arguments that can be supplied to the `default_qty_type` parameter in the [strategy](#fun_strategy) declaration statement. It is only relevant when no value is used for the ‘qty’ parameter in [strategy.entry](#fun_strategy.entry) or [strategy.order](#fun_strategy.order) function calls. It specifies that a percentage (0-100) of equity will be used to enter trades.

Type

const string

Example

```
//@version=6  
strategy("strategy.percent_of_equity", overlay = false, default_qty_value = 100, default_qty_type = strategy.percent_of_equity, initial_capital = 1000000)  
  
// As ‘qty’ is not defined, the previously defined values for the `default_qty_type` and `default_qty_value` parameters are used to enter trades, namely 100% of available equity.  
if bar_index == 0  
    strategy.entry("EN", strategy.long)  
if bar_index == 2  
    strategy.close("EN")  
plot(strategy.equity)  
  
 // The ‘qty’ parameter is set to 10. Entering position with fixed size of 10 contracts and entry market price = (10 * close).  
if bar_index == 4  
    strategy.entry("EN", strategy.long, qty = 10)  
if bar_index == 6  
    strategy.close("EN")
```

See also

[strategy](#fun_strategy)
