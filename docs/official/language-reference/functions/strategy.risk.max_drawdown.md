### strategy.risk.max\_drawdown()

The purpose of this rule is to determine maximum drawdown. The rule affects the whole strategy. Once the maximum drawdown value is reached, all pending orders are cancelled, all open positions are closed and no new orders can be placed.

Syntax

```
strategy.risk.max_drawdown(value, type, alert_message) → void
```

Arguments

value (simple int/float) A required parameter. The maximum drawdown value. It is specified either in money (base currency), or in percentage of maximum equity. For % of equity the range of allowed values is from 0 to 100.

type (simple string) A required parameter. The type of the value. Please specify one of the following values: [strategy.percent\_of\_equity](#const_strategy.percent_of_equity) or [strategy.cash](#const_strategy.cash). Note: if equity drops down to zero or to a negative and the 'strategy.percent\_of\_equity' is specified, all pending orders are cancelled, all open positions are closed and no new orders can be placed for good.

alert\_message (simple string) An optional parameter which replaces the {{strategy.order.alert\_message}} placeholder when it is used in the "Create Alert" dialog box's "Message" field.

Example

```
//@version=6  
strategy("risk.max_drawdown Demo 1")  
strategy.risk.max_drawdown(50, strategy.percent_of_equity) // set maximum drawdown to 50% of maximum equity  
plot(strategy.position_size)
```

Example

```
//@version=6  
strategy("risk.max_drawdown Demo 2", currency = "EUR")  
strategy.risk.max_drawdown(2000, strategy.cash) // set maximum drawdown to 2000 EUR from maximum equity  
plot(strategy.position_size)
```
