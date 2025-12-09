### strategy.convert\_to\_account()

Converts the value from the currency that the symbol on the chart is traded in ([syminfo.currency](#var_syminfo.currency)) to the currency used by the strategy ([strategy.account\_currency](#var_strategy.account_currency)).

Syntax

```
strategy.convert_to_account(value) → series float
```

Arguments

value (series int/float) The value to be converted.

Example

```
//@version=6  
strategy("`strategy.convert_to_account` Example 1", currency = currency.EUR)  
  
plot(close, "Close price using default currency")  
plot(strategy.convert_to_account(close), "Close price converted to strategy currency")
```

Example

```
// Calculates the "Buy and hold return" using your account's currency.  
//@version=6  
strategy("`strategy.convert_to_account` Example 2", currency = currency.EUR)  
  
dateInput = input.time(timestamp("20 Jul 2021 00:00 +0300"), "From Date", confirm = true)  
  
buyAndHoldReturnPct(fromDate) =>  
    if time >= fromDate  
        money = close * syminfo.pointvalue  
        var initialBal = strategy.convert_to_account(money)  
        (strategy.convert_to_account(money) - initialBal) / initialBal * 100  
  
plot(buyAndHoldReturnPct(dateInput))
```

See also

[strategy](#fun_strategy)[strategy.convert\_to\_symbol](#fun_strategy.convert_to_symbol)
