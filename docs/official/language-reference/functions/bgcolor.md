### bgcolor()

Fill background of bars with specified color.

Syntax

```
bgcolor(color, offset, editable, show_last, title, display, force_overlay) → void
```

Arguments

color (series color) Color of the filled background. You can use constants like 'red' or '#ff001a' as well as complex expressions like 'close >= open ? color.green : color.red'. Required argument.

offset (simple int) Shifts the color series to the left or to the right on the given number of bars. Default is 0.

editable (input bool) If true then bgcolor style will be editable in Format dialog. Default is true.

show\_last (input int) Optional. The number of bars, counting backwards from the most recent bar, on which the function can draw.

title (const string) Title of the bgcolor. Optional argument.

display (input plot\_simple\_display) Controls where the bgcolor is displayed. Possible values are: [display.none](#const_display.none), [display.all](#const_display.all). Default is [display.all](#const_display.all).

force\_overlay (const bool) If [true](#const_true), the plotted results will display on the main chart pane, even when the script occupies a separate pane. Optional. The default is [false](#const_false).

Example

```
//@version=6  
indicator("bgcolor example", overlay=true)  
bgcolor(close < open ? color.new(color.red,70) : color.new(color.green, 70))
```

See also

[barcolor](#fun_barcolor)[plot](#fun_plot)[fill](#fun_fill)
