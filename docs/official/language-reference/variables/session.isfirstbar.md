### session.isfirstbar

Returns [true](#const_true) if the current bar is the first bar of the day's session, [false](#const_false) otherwise. If extended session information is used, only returns `true` on the first bar of the pre-market bars.

Type

series bool

Example

```
//@version=6  
strategy("`session.isfirstbar` Example", overlay = true)  
longCondition = year >= 2022  
// Place a long order at the `close` of the trading session's first bar.  
if session.isfirstbar and longCondition  
    strategy.entry("Long", strategy.long)  
  
// Close the long position at the `close` of the trading session's last bar.  
if session.islastbar and barstate.isconfirmed  
    strategy.close("Long", immediately = true)
```

See also

[session.isfirstbar\_regular](#var_session.isfirstbar_regular)[session.islastbar](#var_session.islastbar)[session.islastbar\_regular](#var_session.islastbar_regular)
