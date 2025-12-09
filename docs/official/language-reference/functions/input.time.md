### input.time()

Adds two inputs to the script's "Settings/Inputs" tab on the same line: one for the date and one for the time. The user can change the price in the settings or by selecting the indicator and dragging the price line. The function returns a date/time value in UNIX format.

Syntax

```
input.time(defval, title, tooltip, inline, group, confirm, display, active) → input int
```

Arguments

defval (const int) Determines the default value of the input variable proposed in the script's "Settings/Inputs" tab, from where the user can change it. The value can be a [timestamp](#fun_timestamp) function, but only if it uses a date argument in const string format.

title (const string) Title of the input. If not specified, the variable name is used as the input's title. If the title is specified, but it is empty, the name will be an empty string.

tooltip (const string) The string that will be shown to the user when hovering over the tooltip icon.

inline (const string) Combines all the input calls using the same argument in one line. The string used as an argument is not displayed. It is only used to identify inputs belonging to the same line.

group (const string) Creates a header above all inputs using the same group argument string. The string is also used as the header's text.

confirm (const bool) Optional. If [true](#const_true), the script prompts the user to set the input's initial value by clicking a point on the chart. If inputs of other types require confirmation, the "Confirm inputs" dialog box also displays this input's field, allowing final adjustments to the value before the script starts to run. The default is [false](#const_false).

display (const plot\_display) Controls where the script will display the input's information, aside from within the script's settings. This option allows one to remove a specific input from the script's status line or the Data Window to ensure only the most necessary inputs are displayed there. Possible values: [display.none](#const_display.none), [display.data\_window](#const_display.data_window), [display.status\_line](#const_display.status_line), [display.all](#const_display.all). Optional. The default is [display.none](#const_display.none).

active (input bool) Optional. Specifies whether users can change the value of the input in the script's "Settings/Inputs" tab. The script can use this parameter to set the state of the input based on the values of other inputs. If [true](#const_true), users can change the value of the input. If [false](#const_false), the input is grayed out, and users cannot change the value. The default is [true](#const_true).

Example

```
//@version=6  
indicator("input.time", overlay=true)  
i_date = input.time(timestamp("20 Jul 2021 00:00 +0300"), "Date")  
l = label.new(i_date, high, "Date", xloc=xloc.bar_time)  
label.delete(l[1])
```

Returns

Value of input variable.

Remarks

The user can change the input's value by specifying a new value in the "Settings/Inputs" tab, or by moving the input's marker on the chart. Alternatively, they can select "Reset points" from the script's "More" menu and set a new input value by clicking a point on the chart.

If an [input.time](#fun_input.time) and [input.price](#fun_input.price) function call in the script share a unique `inline` argument and have matching `group` arguments, those calls create a single interactive point marker on the chart. The user can move that marker to adjust the input time and price values simultaneously.

See also

[input.bool](#fun_input.bool)[input.int](#fun_input.int)[input.float](#fun_input.float)[input.string](#fun_input.string)[input.text\_area](#fun_input.text_area)[input.symbol](#fun_input.symbol)[input.timeframe](#fun_input.timeframe)[input.session](#fun_input.session)[input.source](#fun_input.source)[input.color](#fun_input.color)[input](#fun_input)
