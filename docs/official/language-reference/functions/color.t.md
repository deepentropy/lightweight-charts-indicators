### color.t()

4 overloads

Retrieves the color's transparency.

Syntax & Overloads

[```
color.t(color) → const float
```](#fun_color.t-0)[```
color.t(color) → input float
```](#fun_color.t-1)[```
color.t(color) → simple float
```](#fun_color.t-2)[```
color.t(color) → series float
```](#fun_color.t-3)

Arguments

color (const color) Color.

Example

```
//@version=6  
indicator("color.t", overlay=true)  
plot(color.t(color.new(color.red, 50)))
```

Returns

The value (0-100) of the color's transparency.
