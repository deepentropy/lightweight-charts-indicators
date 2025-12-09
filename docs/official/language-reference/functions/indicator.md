### indicator()

This declaration statement designates the script as an indicator and sets a number of indicator-related properties.

Syntax

```
indicator(title, shorttitle, overlay, format, precision, scale, max_bars_back, timeframe, timeframe_gaps, explicit_plot_zorder, max_lines_count, max_labels_count, max_boxes_count, calc_bars_count, max_polylines_count, dynamic_requests, behind_chart) → void
```

Arguments

title (const string) The title of the script. It is displayed on the chart when no `shorttitle` argument is used, and becomes the publication's default title when publishing the script.

shorttitle (const string) The script's display name on charts. If specified, it will replace the `title` argument in most chart-related windows. Optional. The default is the argument used for `title`.

overlay (const bool) If [true](#const_true), the script's visuals appear on the main chart pane if the user adds it to the chart directly, or in another script's pane if the user applies it to that script. If [false](#const_false), the script's visuals appear in a separate pane. Changes to the `overlay` value apply only after the user adds the script to the chart again. Additionally, if the user moves the script to another pane by selecting a "Move to" option in the script's "More" menu, it does not move back to its original pane after any updates to the source code. The default is [false](#const_false). Strategy-specific labels that display entries and exits will be displayed over the main chart regardless of this setting.

format (const string) Specifies the formatting of the script's displayed values. Possible values: [format.inherit](#const_format.inherit), [format.price](#const_format.price), [format.volume](#const_format.volume), [format.percent](#const_format.percent). Optional. The default is [format.inherit](#const_format.inherit).

precision (const int) Specifies the number of digits after the floating point of the script's displayed values. Must be a non-negative integer no greater than 16. If `format` is set to [format.inherit](#const_format.inherit) and `precision` is specified, the format will instead be set to [format.price](#const_format.price). When the function's `format` parameter uses [format.volume](#const_format.volume), the `precision` parameter will not affect the result, as the decimal precision rules defined by [format.volume](#const_format.volume) supersede other precision settings. Optional. The default is inherited from the precision of the chart's symbol.

scale (const scale\_type) The price scale used. Possible values: [scale.right](#const_scale.right), [scale.left](#const_scale.left), [scale.none](#const_scale.none). The [scale.none](#const_scale.none) value can only be applied in combination with `overlay = true`. Optional. By default, the script uses the same scale as the chart.

max\_bars\_back (const int) The length of the historical buffer the script keeps for every variable and function, which determines how many past values can be referenced using the `[]` history-referencing operator. The required buffer size is automatically detected by the Pine Script® runtime. Using this parameter is only necessary when a runtime error occurs because automatic detection fails. More information on the underlying mechanics of the historical buffer can be found [in our Help Center](https://www.tradingview.com/chart/?solution=43000587849). Optional. The default is 0.

timeframe (const string) Adds multi-timeframe functionality to simple scripts. When specified, a "Timeframe" field will be included in the "Calculation" section of the script's "Settings/Inputs" tab. The field's default value will be the argument supplied, whose format must conform to [timeframe string specifications](https://www.tradingview.com/pine-script-docs/concepts/timeframes/#timeframe-string-specifications). To specify the chart's timeframe, use an empty string or the [timeframe.period](#var_timeframe.period) variable. The parameter cannot be used with scripts using Pine Script® drawings. Optional. The default is [timeframe.period](#var_timeframe.period).

timeframe\_gaps (const bool) Specifies how the indicator's values are displayed on chart bars when the `timeframe` is higher than the chart's. If [true](#const_true), a value only appears on a chart bar when the higher `timeframe` value becomes available, otherwise [na](#var_na) is returned (thus a "gap" occurs). With [false](#const_false), what would otherwise be gaps are filled with the latest known value returned, avoiding [na](#var_na) values. When specified, a "Wait for timeframe closes" checkbox will be included in the "Calculation" section of the script's "Settings/Inputs" tab. Optional. The default is [true](#const_true).

explicit\_plot\_zorder (const bool) Specifies the order in which the script's plots, fills, and hlines are rendered. If [true](#const_true), plots are drawn in the order in which they appear in the script's code, each newer plot being drawn above the previous ones. This only applies to `plot*()` functions, [fill](#fun_fill), and [hline](#fun_hline). Optional. The default is [false](#const_false).

max\_lines\_count (const int) The number of last [line](#type_line) drawings displayed. Possible values: 1-500. The count is approximate; more drawings than the specified count may be displayed. Optional. The default is 50.

max\_labels\_count (const int) The number of last [label](#type_label) drawings displayed. Possible values: 1-500. The count is approximate; more drawings than the specified count may be displayed. Optional. The default is 50.

max\_boxes\_count (const int) The number of last [box](#type_box) drawings displayed. Possible values: 1-500. The count is approximate; more drawings than the specified count may be displayed. Optional. The default is 50.

calc\_bars\_count (const int) Limits the initial calculation of a script to the last number of bars specified. When specified, a "Calculated bars" field will be included in the "Calculation" section of the script's "Settings/Inputs" tab. Optional. The default is 0, in which case the script executes on all available bars.

max\_polylines\_count (const int) The number of last [polyline](#type_polyline) drawings displayed. Possible values: 1-100. The count is approximate; more drawings than the specified count may be displayed. Optional. The default is 50.

dynamic\_requests (const bool) Specifies whether the script can dynamically call functions from the `request.*()` namespace. Dynamic `request.*()` calls are allowed within the local scopes of conditional structures (e.g., [if](#kw_if)), loops (e.g., [for](#kw_for)), and exported functions. Additionally, such calls allow "series" arguments for many of their parameters. Optional. The default is [true](#const_true). See the User Manual's [Dynamic requests](https://www.tradingview.com/pine-script-docs/concepts/other-timeframes-and-data/#dynamic-requests) section for more information.

behind\_chart (const bool)  Optional. Controls whether all plots and drawings appear behind the chart display (if [true](#const_true)) or in front of it (if [false](#const_false)). This parameter only takes effect when the `overlay` parameter is `true`. The default is [true](#const_true).

Example

```
//@version=6  
indicator("My script", shorttitle="Script")  
plot(close)
```

Remarks

Every indicator script must have one [indicator](#fun_indicator) call.

See also

[strategy](#fun_strategy)[library](#fun_library)
