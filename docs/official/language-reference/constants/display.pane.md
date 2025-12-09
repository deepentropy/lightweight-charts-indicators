### display.pane

A named constant for use with the `display` parameter of the `plot*()` functions. Specifies that the plotted values are displayed in a chart pane by default.

Type

const plot\_display

Remarks

The `display.*` constants support [+](#op_+) and [-](#op_-) operations, enabling custom combinations of display settings. For example, `display.pane + display.data_window` specifies that the plot's values appear in the chart pane and the Data Window, and `display.all - display.pane` specifies that the values appear in all possible locations except for the chart pane.

Selecting a deselected plot in the script's "Settings/Style" tab changes its display settings, causing the plotted data to appear in all available chart locations. To restore the display settings coded in the script, select "Reset settings" from the "Defaults" dropdown menu at the bottom of the "Settings" dialog box.

See also

[plot](#fun_plot)[plotshape](#fun_plotshape)[plotchar](#fun_plotchar)[plotarrow](#fun_plotarrow)[plotbar](#fun_plotbar)[plotcandle](#fun_plotcandle)
