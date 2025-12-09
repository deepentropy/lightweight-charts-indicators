### display.all

A named constant for use with the `display` parameter of the `plot*()`, `input*()`, [fill](#fun_fill), [bgcolor](#fun_bgcolor), [barcolor](#fun_barcolor), and [hline](#fun_hline) functions. Specifies that the values or visuals appear in all possible locations by default.

Type

const plot\_simple\_display

Remarks

The `display.*` constants support [+](#op_+) and [-](#op_-) operations, enabling custom combinations of display settings. For example, `display.all - display.data_window` specifies that the data for an input or plot appears in all possible locations except for the Data Window.

Selecting a deselected plot in the script's "Settings/Style" tab changes its display settings, causing the plotted data to appear in all available chart locations. To restore the display settings coded in the script, select "Reset settings" from the "Defaults" dropdown menu at the bottom of the "Settings" dialog box.

See also

[plot](#fun_plot)[plotshape](#fun_plotshape)[plotchar](#fun_plotchar)[plotarrow](#fun_plotarrow)[plotbar](#fun_plotbar)[plotcandle](#fun_plotcandle)
