### ta.wpr()

Williams %R. The oscillator shows the current closing price in relation to the high and low of the past 'length' bars.

Syntax

```
ta.wpr(length) → series float
```

Arguments

length (series int) Number of bars.

Example

```
//@version=6  
indicator("Williams %R", shorttitle="%R", format=format.price, precision=2)  
plot(ta.wpr(14), title="%R", color=color.new(#ff6d00, 0))
```

Returns

Williams %R.

Remarks

`na` values in the `source` series are ignored.

See also

[ta.mfi](#fun_ta.mfi)[ta.cmo](#fun_ta.cmo)
