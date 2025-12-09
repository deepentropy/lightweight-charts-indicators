### plotarrow()

Plots up and down arrows on the chart. Up arrow is drawn at every indicator positive value, down arrow is drawn at every negative value. If indicator returns [na](#var_na) then no arrow is drawn. Arrows has different height, the more absolute indicator value the longer arrow is drawn.

Syntax

```
plotarrow(series, title, colorup, colordown, offset, minheight, maxheight, editable, show_last, display, format, precision, force_overlay) → void
```

Arguments

series (series int/float) Series of data to be plotted as arrows. Required argument.

title (const string) Title of the plot.

colorup (series color) Color of the up arrows. Optional argument.

colordown (series color) Color of the down arrows. Optional argument.

offset (simple int) Shifts arrows to the left or to the right on the given number of bars. Default is 0.

minheight (input int) Minimal possible arrow height in pixels. Default is 5.

maxheight (input int) Maximum possible arrow height in pixels. Default is 100.

editable (input bool) If true then plotarrow style will be editable in Format dialog. Default is true.

show\_last (input int) Optional. The number of bars, counting backwards from the most recent bar, on which the function can draw.

display (input plot\_display) Controls where the plot's information is displayed. Display options support addition and subtraction, meaning that using `display.all - display.status_line` will display the plot's information everywhere except in the script's status line. `display.price_scale + display.status_line` will display the plot only in the price scale and status line. When `display` arguments such as `display.price_scale` have user-controlled chart settings equivalents, the relevant plot information will only appear when all settings allow for it. Possible values: [display.none](#const_display.none), [display.pane](#const_display.pane), [display.data\_window](#const_display.data_window), [display.price\_scale](#const_display.price_scale), [display.status\_line](#const_display.status_line), [display.all](#const_display.all). Optional. The default is [display.all](#const_display.all).

format (input string) Determines whether the script formats the plot's values as prices, percentages, or volume values. The argument passed to this parameter supersedes the `format` parameter of the [indicator](#fun_indicator), and [strategy](#fun_strategy) functions. Optional. The default is the `format` value used by the [indicator](#fun_indicator)/[strategy](#fun_strategy) function. Possible values: [format.price](#const_format.price), [format.percent](#const_format.percent), [format.volume](#const_format.volume).

precision (input int) The number of digits after the decimal point the plot's values show on the chart pane's y-axis, the script's status line, and the Data Window. Accepts a non-negative integer less than or equal to 16. The argument passed to this parameter supersedes the `precision` parameter of the [indicator](#fun_indicator) and [strategy](#fun_strategy) functions. When the function's `format` parameter uses [format.volume](#const_format.volume), the `precision` parameter will not affect the result, as the decimal precision rules defined by [format.volume](#const_format.volume) supersede other precision settings. Optional. The default is the `precision` value used by the [indicator](#fun_indicator)/[strategy](#fun_strategy) function.

force\_overlay (const bool) If [true](#const_true), the plotted results will display on the main chart pane, even when the script occupies a separate pane. Optional. The default is [false](#const_false).

Example

```
//@version=6  
indicator("plotarrow example", overlay=true)  
codiff = close - open  
plotarrow(codiff, colorup=color.new(color.teal,40), colordown=color.new(color.orange, 40))
```

Remarks

Use [plotarrow](#fun_plotarrow) function in conjunction with 'overlay=true' [indicator](#fun_indicator) parameter!

See also

[plot](#fun_plot)[plotshape](#fun_plotshape)[plotchar](#fun_plotchar)[barcolor](#fun_barcolor)[bgcolor](#fun_bgcolor)
