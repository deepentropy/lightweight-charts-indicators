### plotbar()

Plots ohlc bars on the chart.

Syntax

```
plotbar(open, high, low, close, title, color, editable, show_last, display, format, precision, force_overlay) → void
```

Arguments

open (series int/float) Open series of data to be used as open values of bars. Required argument.

high (series int/float) High series of data to be used as high values of bars. Required argument.

low (series int/float) Low series of data to be used as low values of bars. Required argument.

close (series int/float) Close series of data to be used as close values of bars. Required argument.

title (const string) Title of the plotbar. Optional argument.

color (series color) Color of the ohlc bars. You can use constants like 'color=color.red' or 'color=#ff001a' as well as complex expressions like 'color = close >= open ? color.green : color.red'. Optional argument.

editable (input bool) If true then plotbar style will be editable in Format dialog. Default is true.

show\_last (input int) Optional. The number of bars, counting backwards from the most recent bar, on which the function can draw.

display (input plot\_display) Controls where the plot's information is displayed. Display options support addition and subtraction, meaning that using `display.all - display.status_line` will display the plot's information everywhere except in the script's status line. `display.price_scale + display.status_line` will display the plot only in the price scale and status line. When `display` arguments such as `display.price_scale` have user-controlled chart settings equivalents, the relevant plot information will only appear when all settings allow for it. Possible values: [display.none](#const_display.none), [display.pane](#const_display.pane), [display.data\_window](#const_display.data_window), [display.price\_scale](#const_display.price_scale), [display.status\_line](#const_display.status_line), [display.all](#const_display.all). Optional. The default is [display.all](#const_display.all).

format (input string) Determines whether the script formats the plot's values as prices, percentages, or volume values. The argument passed to this parameter supersedes the `format` parameter of the [indicator](#fun_indicator), and [strategy](#fun_strategy) functions. Optional. The default is the `format` value used by the [indicator](#fun_indicator)/[strategy](#fun_strategy) function. Possible values: [format.price](#const_format.price), [format.percent](#const_format.percent), [format.volume](#const_format.volume).

precision (input int) The number of digits after the decimal point the plot's values show on the chart pane's y-axis, the script's status line, and the Data Window. Accepts a non-negative integer less than or equal to 16. The argument passed to this parameter supersedes the `precision` parameter of the [indicator](#fun_indicator) and [strategy](#fun_strategy) functions. When the function's `format` parameter uses [format.volume](#const_format.volume), the `precision` parameter will not affect the result, as the decimal precision rules defined by [format.volume](#const_format.volume) supersede other precision settings. Optional. The default is the `precision` value used by the [indicator](#fun_indicator)/[strategy](#fun_strategy) function.

force\_overlay (const bool) If [true](#const_true), the plotted results will display on the main chart pane, even when the script occupies a separate pane. Optional. The default is [false](#const_false).

Example

```
//@version=6  
indicator("plotbar example", overlay=true)  
plotbar(open, high, low, close, title='Title', color = open < close ? color.green : color.red)
```

Remarks

Even if one value of open, high, low or close equal NaN then bar no draw.

The maximal value of open, high, low or close will be set as 'high', and the minimal value will be set as 'low'.

See also

[plotcandle](#fun_plotcandle)
