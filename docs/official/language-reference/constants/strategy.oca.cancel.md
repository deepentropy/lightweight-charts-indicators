### strategy.oca.cancel

A named constant for use with the `oca_type` parameter of the [strategy.entry](#fun_strategy.entry) and [strategy.order](#fun_strategy.order) commands. It specifies that the strategy cancels the unfilled order when another order with the same `oca_name` and `oca_type` executes.

Type

const string

Remarks

Strategies cannot cancel or reduce pending orders from an OCA group if they execute on the same tick. For example, if the market price triggers two stop orders from [strategy.order](#fun_strategy.order) calls with the same `oca_*` arguments, the strategy cannot fully or partially cancel either one.

See also

[strategy.entry](#fun_strategy.entry)[strategy.exit](#fun_strategy.exit)[strategy.order](#fun_strategy.order)
