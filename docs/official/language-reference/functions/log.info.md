### log.info()

2 overloads

Converts the formatting string and value(s) into a formatted string, and sends the result to the "Pine logs" menu tagged with the "info" debug level.

The formatting string can contain literal text and one placeholder in curly braces {} for each value to be formatted. Each placeholder consists of the index of the required argument (beginning at 0) that will replace it, and an optional format specifier. The index represents the position of that argument in the function's argument list.

Syntax & Overloads

[```
log.info(message) → void
```](#fun_log.info-0)[```
log.info(formatString, arg0, arg1, ...) → void
```](#fun_log.info-1)

Arguments

message (series string) Log message.

Example

```
//@version=6  
strategy("My strategy", overlay = true, process_orders_on_close = true)  
bracketTickSizeInput = input.int(1000, "Stoploss/Take-Profit distance (in ticks)")  
  
longCondition = ta.crossover(ta.sma(close, 14), ta.sma(close, 28))  
if (longCondition)  
    limitLevel = close * 1.01  
    log.info("Long limit order has been placed at {0}", limitLevel)  
    strategy.order("My Long Entry Id", strategy.long, limit = limitLevel)  
  
    log.info("Exit orders have been placed: Take-profit at {0}, Stop-loss at {1}", close, limitLevel)  
    strategy.exit("Exit", "My Long Entry Id", profit = bracketTickSizeInput, loss = bracketTickSizeInput)  
  
if strategy.opentrades > 10  
    log.warning("{0} positions opened in the same direction in a row. Try adjusting `bracketTickSizeInput`", strategy.opentrades)  
  
last10Perc = strategy.initial_capital / 10 > strategy.equity  
if (last10Perc and not last10Perc[1])  
    log.error("The strategy has lost 90% of the initial capital!")
```

Returns

The formatted string.

Remarks

Any curly braces within an unquoted pattern must be balanced. For example, "ab {0} de" and "ab '}' de" are valid patterns, but "ab {0'}' de", "ab } de" and "''{''" are not.

The function can apply additional formatting to some values inside of the `{}`. The list of additional formatting options can be found in the EXAMPLE section of the [str.format](#fun_str.format) article.

The string used as the `formatString` argument can contain single quote characters ('). However, one must pair all single quotes in that string to avoid unexpected formatting results.

The "Pine logs..." button is accessible from the "More" dropdown in the Pine Editor and from the "More" dropdown in the status line of any script that uses `log.*()` functions.
