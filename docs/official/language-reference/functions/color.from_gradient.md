### color.from\_gradient()

Based on the relative position of value in the bottom\_value to top\_value range, the function returns a color from the gradient defined by bottom\_color to top\_color.

Syntax

```
color.from_gradient(value, bottom_value, top_value, bottom_color, top_color) → series color
```

Arguments

value (series int/float) Value to calculate the position-dependent color.

bottom\_value (series int/float) Bottom position value corresponding to bottom\_color.

top\_value (series int/float) Top position value corresponding to top\_color.

bottom\_color (series color) Bottom position color.

top\_color (series color) Top position color.

Example

```
//@version=6  
indicator("color.from_gradient", overlay=true)  
color1 = color.from_gradient(close, low, high, color.yellow, color.lime)  
color2 = color.from_gradient(ta.rsi(close, 7), 0, 100, color.rgb(255, 0, 0), color.rgb(0, 255, 0, 50))  
plot(close, color=color1)  
plot(ta.rsi(close,7), color=color2)
```

Returns

A color calculated from the linear gradient between bottom\_color to top\_color.

Remarks

Using this function will have an impact on the colors displayed in the script's "Settings/Style" tab. See the [User Manual](https://www.tradingview.com/pine-script-docs/concepts/colors/#color-selection-through-script-settings) for more information.
