### session.isfirstbar\_regular

Returns [true](#const_true) on the first regular session bar of the day, [false](#const_false) otherwise. The result is the same whether extended session information is used or not.

Type

series bool

Example

```
//@version=6  
strategy("`session.isfirstbar_regular` Example", overlay = true)  
longCondition = year >= 2022  
// Place a long order at the `close` of the trading session's first bar.  
if session.isfirstbar and longCondition  
    strategy.entry("Long", strategy.long)  
// Close the long position at the `close` of the trading session's last bar.  
if session.islastbar_regular and barstate.isconfirmed  
    strategy.close("Long", immediately = true)
```

See also

[session.isfirstbar](#var_session.isfirstbar)[session.islastbar](#var_session.islastbar)
