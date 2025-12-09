### ta.vwap()

2 overloads

Volume weighted average price.

Syntax & Overloads

[```
ta.vwap(source, anchor) → series float
```](#fun_ta.vwap-0)[```
ta.vwap(source, anchor, stdev_mult) → [series float, series float, series float]
```](#fun_ta.vwap-1)

Arguments

source (series int/float) Source used for the VWAP calculation.

anchor (series bool) The condition that triggers the reset of VWAP calculations. When [true](#const_true), calculations reset; when [false](#const_false), calculations proceed using the values accumulated since the previous reset. Optional. The default is equivalent to passing [timeframe.change](#fun_timeframe.change) with "1D" as its argument.

Example

```
//@version=6  
indicator("Simple VWAP")  
vwap = ta.vwap(open)  
plot(vwap)
```

Example

```
//@version=6  
indicator("Advanced VWAP")  
vwapAnchorInput = input.string("Daily", "Anchor", options = ["Daily", "Weekly", "Monthly"])  
stdevMultiplierInput = input.float(1.0, "Standard Deviation Multiplier")  
anchorTimeframe = switch vwapAnchorInput  
    "Daily"   => "1D"  
    "Weekly"  => "1W"  
    "Monthly" => "1M"  
anchor = timeframe.change(anchorTimeframe)  
[vwap, upper, lower] = ta.vwap(open, anchor, stdevMultiplierInput)  
plot(vwap)  
plot(upper, color = color.green)  
plot(lower, color = color.green)
```

Returns

A VWAP series, or a tuple [vwap, upper\_band, lower\_band] if `stdev_mult` is specified.

Remarks

Calculations only begin the first time the anchor condition becomes [true](#const_true). Until then, the function returns [na](#var_na).

See also

[ta.vwap](#var_ta.vwap)
