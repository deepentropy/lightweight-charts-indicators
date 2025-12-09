### color.rgb()

4 overloads

Creates a new color with transparency using the RGB color model.

Syntax & Overloads

[```
color.rgb(red, green, blue, transp) → const color
```](#fun_color.rgb-0)[```
color.rgb(red, green, blue, transp) → input color
```](#fun_color.rgb-1)[```
color.rgb(red, green, blue, transp) → simple color
```](#fun_color.rgb-2)[```
color.rgb(red, green, blue, transp) → series color
```](#fun_color.rgb-3)

Arguments

red (const int/float) Red color component. Possible values are from 0 to 255.

green (const int/float) Green color component. Possible values are from 0 to 255.

blue (const int/float) Blue color component. Possible values are from 0 to 255.

transp (const int/float) Optional. Color transparency. Possible values are from 0 (opaque) to 100 (invisible). Default value is 0.

Example

```
//@version=6  
indicator("color.rgb", overlay=true)  
plot(close, color=color.rgb(255, 0, 0, 50))
```

Returns

Color with specified transparency.

Remarks

Using arguments that are not constants (e.g., 'simple', 'input' or 'series') will have an impact on the colors displayed in the script's "Settings/Style" tab. See the [User Manual](https://www.tradingview.com/pine-script-docs/concepts/colors/#color-selection-through-script-settings) for more information.
