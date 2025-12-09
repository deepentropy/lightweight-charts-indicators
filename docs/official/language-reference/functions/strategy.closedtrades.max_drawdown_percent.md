### strategy.closedtrades.max\_drawdown\_percent()

Returns the maximum drawdown of the closed trade, i.e., the maximum possible loss during the trade, expressed as a percentage and calculated by formula: `Lowest Value During Trade / (Entry Price x Quantity) * 100`.

Syntax

```
strategy.closedtrades.max_drawdown_percent(trade_num) → series float
```

Arguments

trade\_num (series int) The trade number of the closed trade. The number of the first trade is zero.

See also

[strategy.closedtrades.max\_drawdown](#fun_strategy.closedtrades.max_drawdown)[strategy.max\_drawdown](#var_strategy.max_drawdown)
