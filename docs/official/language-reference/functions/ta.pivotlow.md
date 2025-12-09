### ta.pivotlow()

2 overloads

This function returns price of the pivot low point. It returns 'NaN', if there was no pivot low point.

Syntax & Overloads

[```
ta.pivotlow(leftbars, rightbars) → series float
```](#fun_ta.pivotlow-0)[```
ta.pivotlow(source, leftbars, rightbars) → series float
```](#fun_ta.pivotlow-1)

Arguments

leftbars (series int/float) Left strength.

rightbars (series int/float) Right strength.

Example

```
//@version=6  
indicator("PivotLow", overlay=true)  
leftBars = input(2)  
rightBars=input(2)  
pl = ta.pivotlow(close, leftBars, rightBars)  
plot(pl, style=plot.style_cross, linewidth=3, color= color.blue, offset=-rightBars)
```

Returns

Price of the point or 'NaN'.

Remarks

If parameters 'leftbars' or 'rightbars' are series you should use [max\_bars\_back](#fun_max_bars_back) function for the 'source' variable.
