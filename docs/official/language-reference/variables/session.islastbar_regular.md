### session.islastbar\_regular

Returns [true](#const_true) on the last regular session bar of the day, [false](#const_false) otherwise. The result is the same whether extended session information is used or not.

Type

series bool

Example

```
//@version=6  
strategy("`session.islastbar_regular` Example", overlay = true)  
longCondition = year >= 2022  
// Place a long order at the `close` of the trading session's first bar.  
if session.isfirstbar and longCondition  
    strategy.entry("Long", strategy.long)  
// Close the long position at the `close` of the trading session's last bar.  
if session.islastbar_regular and barstate.isconfirmed  
    strategy.close("Long", immediately = true)
```

Remarks

This variable is not guaranteed to return [true](#const_true) once in every session because the last bar of the session might not exist if no trades occur during what should be the session's last bar.

This variable is not guaranteed to work as expected on non-standard chart types, e.g., Renko.

See also

[session.isfirstbar](#var_session.isfirstbar)[session.islastbar](#var_session.islastbar)[session.isfirstbar\_regular](#var_session.isfirstbar_regular)
