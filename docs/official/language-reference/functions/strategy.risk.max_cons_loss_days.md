### strategy.risk.max\_cons\_loss\_days()

The purpose of this rule is to cancel all pending orders, close all open positions and stop placing orders after a specified number of consecutive days with losses. The rule affects the whole strategy.

Syntax

```
strategy.risk.max_cons_loss_days(count, alert_message) → void
```

Arguments

count (simple int) A required parameter. The allowed number of consecutive days with losses.

alert\_message (simple string) An optional parameter which replaces the {{strategy.order.alert\_message}} placeholder when it is used in the "Create Alert" dialog box's "Message" field.

Example

```
//@version=6  
strategy("risk.max_cons_loss_days Demo 1")  
strategy.risk.max_cons_loss_days(3) // No orders will be placed after 3 days, if each day is with loss.  
plot(strategy.position_size)
```
