### strategy.risk.allow\_entry\_in()

This function can be used to specify in which market direction the [strategy.entry](#fun_strategy.entry) function is allowed to open positions.

Syntax

```
strategy.risk.allow_entry_in(value) → void
```

Arguments

value (simple string) The allowed direction. Possible values: [strategy.direction.all](#const_strategy.direction.all), [strategy.direction.long](#const_strategy.direction.long), [strategy.direction.short](#const_strategy.direction.short)

Example

```
//@version=6  
strategy("strategy.risk.allow_entry_in")  
  
strategy.risk.allow_entry_in(strategy.direction.long)  
if open > close  
    strategy.entry("Long", strategy.long)  
// Instead of opening a short position with 10 contracts, this command will close long entries.  
if open < close  
    strategy.entry("Short", strategy.short, qty = 10)
```
