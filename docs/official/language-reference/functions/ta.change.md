### ta.change()

3 overloads

Compares the current `source` value to its value `length` bars ago and returns the difference.

Syntax & Overloads

[```
ta.change(source, length) → series int
```](#fun_ta.change-0)[```
ta.change(source, length) → series float
```](#fun_ta.change-1)[```
ta.change(source, length) → series bool
```](#fun_ta.change-2)

Arguments

source (series int) Source series.

length (series int) How far the past `source` value is offset from the current one, in bars. Optional. The default is 1.

Example

```
//@version=6  
indicator('Day and Direction Change', overlay = true)  
dailyBarTime = time('1D')  
isNewDay = ta.change(dailyBarTime) != 0  
bgcolor(isNewDay ? color.new(color.green, 80) : na)  
  
isGreenBar = close >= open  
colorChange = ta.change(isGreenBar)  
plotshape(colorChange, 'Direction Change')
```

Returns

The difference between the values when they are numerical. When a 'bool' source is used, returns `true` when the current source is different from the previous source.

Remarks

`na` values in the `source` series are included in calculations and will produce an `na` result.

See also

[ta.mom](#fun_ta.mom)[ta.cross](#fun_ta.cross)
