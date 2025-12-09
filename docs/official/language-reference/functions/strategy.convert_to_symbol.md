### strategy.convert\_to\_symbol()

Converts the value from the currency used by the strategy ([strategy.account\_currency](#var_strategy.account_currency)) to the currency that the symbol on the chart is traded in ([syminfo.currency](#var_syminfo.currency)).

Syntax

```
strategy.convert_to_symbol(value) → series float
```

Arguments

value (series int/float) The value to be converted.

Example

```
//@version=6  
strategy("`strategy.convert_to_symbol` Example", currency = currency.EUR)  
  
// Calculate the max qty we can buy using current chart's currency.  
calcContracts(accountMoney) =>  
    math.floor(strategy.convert_to_symbol(accountMoney) / syminfo.pointvalue / close)  
  
// Return max qty we can buy using 300 euros  
qt = calcContracts(300)  
  
// Strategy calls to enter long trades every 15 bars and exit long trades every 20 bars using our custom qty.  
if bar_index % 15 == 0  
    strategy.entry("Long", strategy.long, qty = qt)  
if bar_index % 20 == 0  
    strategy.close("Long")
```

See also

[strategy](#fun_strategy)[strategy.convert\_to\_account](#fun_strategy.convert_to_account)
