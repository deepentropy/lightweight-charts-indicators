### fill()

3 overloads

Fills background between two plots or hlines with a given color.

Syntax & Overloads

[```
fill(hline1, hline2, color, title, editable, fillgaps, display) → void
```](#fun_fill-0)[```
fill(plot1, plot2, color, title, editable, show_last, fillgaps, display) → void
```](#fun_fill-1)[```
fill(plot1, plot2, top_value, bottom_value, top_color, bottom_color, title, display, fillgaps, editable) → void
```](#fun_fill-2)

Arguments

hline1 (hline) The first hline object. Required argument.

hline2 (hline) The second hline object. Required argument.

color (series color) Color of the background fill. You can use constants like 'color=color.red' or 'color=#ff001a' as well as complex expressions like 'color = close >= open ? color.green : color.red'. Optional argument.

title (const string) Title of the created fill object. Optional argument.

editable (input bool) If true then fill style will be editable in Format dialog. Default is true.

fillgaps (const bool) Controls continuing fills on gaps, i.e., when one of the plot() calls returns an na value. When true, the last fill will continue on gaps. The default is false.

display (input plot\_simple\_display) Controls where the fill is displayed. Possible values are: [display.none](#const_display.none), [display.all](#const_display.all). Default is [display.all](#const_display.all).

Fill between two horizontal lines

Example

```
//@version=6  
indicator("Fill between hlines", overlay = false)  
h1 = hline(20)  
h2 = hline(10)  
fill(h1, h2, color = color.new(color.blue, 90))
```

Fill between two plots

Example

```
//@version=6  
indicator("Fill between plots", overlay = true)  
p1 = plot(open)  
p2 = plot(close)  
fill(p1, p2, color = color.new(color.green, 90))
```

Gradient fill between two horizontal lines

Example

```
//@version=6  
indicator("Gradient Fill between hlines", overlay = false)  
topVal = input.int(100)  
botVal = input.int(0)  
topCol = input.color(color.red)  
botCol = input.color(color.blue)  
topLine = hline(100, color = topCol, linestyle = hline.style_solid)  
botLine = hline(0,   color = botCol, linestyle = hline.style_solid)  
fill(topLine, botLine, topVal, botVal, topCol, botCol)
```

See also

[plot](#fun_plot)[barcolor](#fun_barcolor)[bgcolor](#fun_bgcolor)[hline](#fun_hline)[color.new](#fun_color.new)
