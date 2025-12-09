### strategy.risk.max\_intraday\_filled\_orders()

The purpose of this rule is to determine maximum number of filled orders per 1 day (per 1 bar, if chart resolution is higher than 1 day). The rule affects the whole strategy. Once the maximum number of filled orders is reached, all pending orders are cancelled, all open positions are closed and no new orders can be placed till the end of the current trading session.

Syntax

```
strategy.risk.max_intraday_filled_orders(count, alert_message) → void
```

Arguments

count (simple int) A required parameter. The maximum number of filled orders per 1 day.

alert\_message (simple string) An optional parameter which replaces the {{strategy.order.alert\_message}} placeholder when it is used in the "Create Alert" dialog box's "Message" field.

Example

```
//@version=6  
strategy("risk.max_intraday_filled_orders Demo")  
strategy.risk.max_intraday_filled_orders(10) // After 10 orders are filled, no more strategy orders will be placed (except for a market order to exit current open market position, if there is any).  
if open > close  
    strategy.entry("buy", strategy.long)  
if open < close  
    strategy.entry("sell", strategy.short)
```
