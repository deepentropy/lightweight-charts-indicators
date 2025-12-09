### syminfo.prefix

Prefix of current symbol name (i.e. for 'CME\_EOD:TICKER' prefix is 'CME\_EOD').

Type

simple string

Example

```
//@version=6  
indicator("syminfo.prefix")  
  
// If current chart symbol is 'BATS:MSFT' then syminfo.prefix is 'BATS'.  
if barstate.islastconfirmedhistory  
    label.new(bar_index, high, text=syminfo.prefix)
```

See also

[syminfo.ticker](#var_syminfo.ticker)[syminfo.tickerid](#var_syminfo.tickerid)
