### strategy.opentrades.max\_runup\_percent()

Returns the maximum run-up of the open trade, i.e., the maximum possible profit during the trade, expressed as a percentage and calculated by formula: `Highest Value During Trade / (Entry Price x Quantity) * 100`.

Syntax

```
strategy.opentrades.max_runup_percent(trade_num) → series float
```

Arguments

trade\_num (series int) The trade number of the closed trade. The number of the first trade is zero.

See also

[strategy.opentrades.max\_runup](#fun_strategy.opentrades.max_runup)[strategy.max\_runup](#var_strategy.max_runup)
