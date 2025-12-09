### ta.pivothigh()

2 overloads

This function returns price of the pivot high point. It returns 'NaN', if there was no pivot high point.

Syntax & Overloads

[```
ta.pivothigh(leftbars, rightbars) → series float
```](#fun_ta.pivothigh-0)[```
ta.pivothigh(source, leftbars, rightbars) → series float
```](#fun_ta.pivothigh-1)

Arguments

leftbars (series int/float) Left strength.

rightbars (series int/float) Right strength.

Example

```
//@version=6  
indicator("PivotHigh", overlay=true)  
leftBars = input(2)  
rightBars=input(2)  
ph = ta.pivothigh(leftBars, rightBars)  
plot(ph, style=plot.style_cross, linewidth=3, color= color.red, offset=-rightBars)
```

Returns

Price of the point or 'NaN'.

Remarks

If parameters 'leftbars' or 'rightbars' are series you should use [max\_bars\_back](#fun_max_bars_back) function for the 'source' variable.
