### color.new()

4 overloads

Function color applies the specified transparency to the given color.

Syntax & Overloads

[```
color.new(color, transp) → const color
```](#fun_color.new-0)[```
color.new(color, transp) → input color
```](#fun_color.new-1)[```
color.new(color, transp) → simple color
```](#fun_color.new-2)[```
color.new(color, transp) → series color
```](#fun_color.new-3)

Arguments

color (const color) Color to apply transparency to.

transp (const int/float) Possible values are from 0 (not transparent) to 100 (invisible).

Example

```
//@version=6  
indicator("color.new", overlay=true)  
plot(close, color=color.new(color.red, 50))
```

Returns

Color with specified transparency.

Remarks

Using arguments that are not constants (e.g., 'simple', 'input' or 'series') will have an impact on the colors displayed in the script's "Settings/Style" tab. See the [User Manual](https://www.tradingview.com/pine-script-docs/concepts/colors/#color-selection-through-script-settings) for more information.
