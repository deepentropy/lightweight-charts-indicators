### display.price\_scale

A named constant for use with the `display` parameter of the `plot*()` functions. Specifies that the price scale displays a label for the plot's data, but only if the chart's settings allow it.

Type

const plot\_display

Remarks

The `display.*` constants support [+](#op_+) and [-](#op_-) operations, enabling custom combinations of display settings. For example, `display.price_scale + display.data_window` specifies that the plot's data appears on the price scale and in the Data Window, and `display.all - display.price_scale` specifies that the data appears in all possible locations except for the price scale.

Selecting a deselected plot in the script's "Settings/Style" tab changes its display settings, causing the plotted data to appear in all available chart locations. To restore the display settings coded in the script, select "Reset settings" from the "Defaults" dropdown menu at the bottom of the "Settings" dialog box.

See also

[plot](#fun_plot)[plotshape](#fun_plotshape)[plotchar](#fun_plotchar)[plotarrow](#fun_plotarrow)[plotbar](#fun_plotbar)[plotcandle](#fun_plotcandle)
