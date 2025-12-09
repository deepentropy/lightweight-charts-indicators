### color.r()

4 overloads

Retrieves the value of the color's red component.

Syntax & Overloads

[```
color.r(color) → const float
```](#fun_color.r-0)[```
color.r(color) → input float
```](#fun_color.r-1)[```
color.r(color) → simple float
```](#fun_color.r-2)[```
color.r(color) → series float
```](#fun_color.r-3)

Arguments

color (const color) Color.

Example

```
//@version=6  
indicator("color.r", overlay=true)  
plot(color.r(color.red))
```

Returns

The value (0 to 255) of the color's red component.
