### strategy.cash

This is one of the arguments that can be supplied to the `default_qty_type` parameter in the [strategy](#fun_strategy) declaration statement. It is only relevant when no value is used for the ‘qty’ parameter in [strategy.entry](#fun_strategy.entry) or [strategy.order](#fun_strategy.order) function calls. It specifies that an amount of cash in the `strategy.account_currency` will be used to enter trades.

Type

const string

Example

```
//@version=6  
strategy("strategy.cash", overlay = true, default_qty_value = 50, default_qty_type = strategy.cash, initial_capital = 1000000)  
  
if bar_index == 0  
    // As ‘qty’ is not defined, the previously defined values for the `default_qty_type` and `default_qty_value` parameters are used to enter trades, namely 50 units of cash in the currency of `strategy.account_currency`.  
    // `qty` is calculated as (default_qty_value)/(close price). If current price is $5, then qty = 50/5 = 10.  
    strategy.entry("EN", strategy.long)  
if bar_index == 2  
    strategy.close("EN")
```

See also

[strategy](#fun_strategy)
