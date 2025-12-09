### display.pine\_screener

A named constant for use with the `display` parameter of the [plot](#fun_plot) function. Specifies that, by default, the [Pine Screener](https://www.tradingview.com/support/solutions/43000742436/) displays a column for the plot's values when the user applies the indicator to the chosen watchlist.

Type

const plot\_display

Remarks

The `display.*` constants support [+](#op_+) and [-](#op_-) operations, enabling custom combinations of display settings. For example, `display.data_window + display.pine_screener` specifies that the plotted values appear in the Data Window and the Pine Screener, and `display.all - display.pine_screener` specifies that the values appear in all possible locations except for the Pine Screener.

The Pine Screener displays columns for only the first 10 enabled plots from a script by default. If a plot's default display settings do not include the screener, or if the screener already shows columns for 10 other plots from the script, users can configure the screener to show a column for the plot by using the "Manage columns" menu at the far right of the table header.

See also

[plot](#fun_plot)[plotshape](#fun_plotshape)[plotchar](#fun_plotchar)[plotarrow](#fun_plotarrow)[plotbar](#fun_plotbar)[plotcandle](#fun_plotcandle)
