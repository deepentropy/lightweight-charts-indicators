### plotchar()

Plots visual shapes using any given one Unicode character on the chart.

Syntax

```
plotchar(series, title, char, location, color, offset, text, textcolor, editable, size, show_last, display, format, precision, force_overlay) → void
```

Arguments

series (series int/float/bool) Series of data to be plotted as shapes. Series is treated as a series of boolean values for all location values except [location.absolute](#const_location.absolute). Required argument.

title (const string) Title of the plot.

char (input string) Character to use as a visual shape.

location (input string) Location of shapes on the chart. Possible values are: [location.abovebar](#const_location.abovebar), [location.belowbar](#const_location.belowbar), [location.top](#const_location.top), [location.bottom](#const_location.bottom), [location.absolute](#const_location.absolute). Default value is [location.abovebar](#const_location.abovebar).

color (series color) Color of the shapes. You can use constants like 'color=color.red' or 'color=#ff001a' as well as complex expressions like 'color = close >= open ? color.green : color.red'. Optional argument.

offset (simple int) Shifts shapes to the left or to the right on the given number of bars. Default is 0.

text (const string) Text to display with the shape. You can use multiline text, to separate lines use '\n' escape sequence. Example: 'line one\nline two'.

textcolor (series color) Color of the text. You can use constants like 'textcolor=color.red' or 'textcolor=#ff001a' as well as complex expressions like 'textcolor = close >= open ? color.green : color.red'. Optional argument.

editable (input bool) If true then plotchar style will be editable in Format dialog. Default is true.

size (const string) Size of characters on the chart. Possible values are: [size.auto](#const_size.auto), [size.tiny](#const_size.tiny), [size.small](#const_size.small), [size.normal](#const_size.normal), [size.large](#const_size.large), [size.huge](#const_size.huge). Default is [size.auto](#const_size.auto).

show\_last (input int) Optional. The number of bars, counting backwards from the most recent bar, on which the function can draw.

display (input plot\_display) Controls where the plot's information is displayed. Display options support addition and subtraction, meaning that using `display.all - display.status_line` will display the plot's information everywhere except in the script's status line. `display.price_scale + display.status_line` will display the plot only in the price scale and status line. When `display` arguments such as `display.price_scale` have user-controlled chart settings equivalents, the relevant plot information will only appear when all settings allow for it. Possible values: [display.none](#const_display.none), [display.pane](#const_display.pane), [display.data\_window](#const_display.data_window), [display.price\_scale](#const_display.price_scale), [display.status\_line](#const_display.status_line), [display.all](#const_display.all). Optional. The default is [display.all](#const_display.all).

format (input string) Determines whether the script formats the plot's values as prices, percentages, or volume values. The argument passed to this parameter supersedes the `format` parameter of the [indicator](#fun_indicator), and [strategy](#fun_strategy) functions. Optional. The default is the `format` value used by the [indicator](#fun_indicator)/[strategy](#fun_strategy) function. Possible values: [format.price](#const_format.price), [format.percent](#const_format.percent), [format.volume](#const_format.volume).

precision (input int) The number of digits after the decimal point the plot's values show on the chart pane's y-axis, the script's status line, and the Data Window. Accepts a non-negative integer less than or equal to 16. The argument passed to this parameter supersedes the `precision` parameter of the [indicator](#fun_indicator) and [strategy](#fun_strategy) functions. When the function's `format` parameter uses [format.volume](#const_format.volume), the `precision` parameter will not affect the result, as the decimal precision rules defined by [format.volume](#const_format.volume) supersede other precision settings. Optional. The default is the `precision` value used by the [indicator](#fun_indicator)/[strategy](#fun_strategy) function.

force\_overlay (const bool) If [true](#const_true), the plotted results will display on the main chart pane, even when the script occupies a separate pane. Optional. The default is [false](#const_false).

Example

```
//@version=6  
indicator("plotchar example", overlay=true)  
data = close >= open  
plotchar(data, char='❄')
```

Remarks

Use [plotchar](#fun_plotchar) function in conjunction with 'overlay=true' [indicator](#fun_indicator) parameter!

See also

[plot](#fun_plot)[plotshape](#fun_plotshape)[plotarrow](#fun_plotarrow)[barcolor](#fun_barcolor)[bgcolor](#fun_bgcolor)
