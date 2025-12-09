### syminfo.root

Root for derivatives like futures contract. For other symbols returns the same value as [syminfo.ticker](#var_syminfo.ticker).

Type

simple string

Example

```
//@version=6  
indicator("syminfo.root")  
  
// If the current chart symbol is continuous futures ('ES1!'), it would display 'ES'.  
if barstate.islastconfirmedhistory  
    label.new(bar_index, high, syminfo.root)
```

See also

[syminfo.ticker](#var_syminfo.ticker)[syminfo.tickerid](#var_syminfo.tickerid)
