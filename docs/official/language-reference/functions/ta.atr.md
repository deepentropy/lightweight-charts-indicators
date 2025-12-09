### ta.atr()

Function atr (average true range) returns the RMA of true range. True range is max(high - low, abs(high - close[1]), abs(low - close[1])).

Syntax

```
ta.atr(length) → series float
```

Arguments

length (simple int) Length (number of bars back).

Example

```
//@version=6  
indicator("ta.atr")  
plot(ta.atr(14))  
  
//the same on pine  
pine_atr(length) =>  
    trueRange = na(high[1])? high-low : math.max(math.max(high - low, math.abs(high - close[1])), math.abs(low - close[1]))  
    //true range can be also calculated with ta.tr(true)  
    ta.rma(trueRange, length)  
  
plot(pine_atr(14))
```

Returns

Average true range.

Remarks

`na` values in the `source` series are ignored; the function calculates on the `length` quantity of non-`na` values.

See also

[ta.tr](#fun_ta.tr)[ta.rma](#fun_ta.rma)
