### hline()

Renders a horizontal line at a given fixed price level.

Syntax

```
hline(price, title, color, linestyle, linewidth, editable, display) → hline
```

Arguments

price (input int/float) Price value at which the object will be rendered. Required argument.

title (const string) Title of the object.

color (input color) Color of the rendered line. Must be a constant value (not an expression). Optional argument.

linestyle (input hline\_style) Style of the rendered line. Possible values are: [hline.style\_solid](#const_hline.style_solid), [hline.style\_dotted](#const_hline.style_dotted), [hline.style\_dashed](#const_hline.style_dashed). Optional argument.

linewidth (input int) Width of the rendered line. Default value is 1.

editable (input bool) If true then hline style will be editable in Format dialog. Default is true.

display (input plot\_simple\_display) Controls where the hline is displayed. Possible values are: [display.none](#const_display.none), [display.all](#const_display.all). Default is [display.all](#const_display.all).

Example

```
//@version=6  
indicator("input.hline", overlay=true)  
hline(3.14, title='Pi', color=color.blue, linestyle=hline.style_dotted, linewidth=2)  
  
// You may fill the background between any two hlines with a fill() function:  
h1 = hline(20)  
h2 = hline(10)  
fill(h1, h2, color=color.new(color.green, 90))
```

Returns

An hline object, that can be used in [fill](#fun_fill)

See also

[fill](#fun_fill)
