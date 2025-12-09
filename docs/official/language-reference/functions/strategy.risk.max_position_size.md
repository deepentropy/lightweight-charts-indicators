### strategy.risk.max\_position\_size()

The purpose of this rule is to determine maximum size of a market position. The rule affects the following function: [strategy.entry](#fun_strategy.entry). The 'entry' quantity can be reduced (if needed) to such number of contracts/shares/lots/units, so the total position size doesn't exceed the value specified in 'strategy.risk.max\_position\_size'. If minimum possible quantity still violates the rule, the order will not be placed.

Syntax

```
strategy.risk.max_position_size(contracts) → void
```

Arguments

contracts (simple int/float) A required parameter. Maximum number of contracts/shares/lots/units in a position.

Example

```
//@version=6  
strategy("risk.max_position_size Demo", default_qty_value = 100)  
strategy.risk.max_position_size(10)  
if open > close  
    strategy.entry("buy", strategy.long)  
plot(strategy.position_size) // max plot value will be 10
```
