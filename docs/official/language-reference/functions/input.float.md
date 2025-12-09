### input.float()

2 overloads

Adds an input to the Inputs tab of your script's Settings, which allows you to provide configuration options to script users. This function adds a field for a float input to the script's inputs.

Syntax & Overloads

[```
input.float(defval, title, options, tooltip, inline, group, confirm, display, active) → input float
```](#fun_input.float-0)[```
input.float(defval, title, minval, maxval, step, tooltip, inline, group, confirm, display, active) → input float
```](#fun_input.float-1)

Arguments

defval (const int/float) Determines the default value of the input variable proposed in the script's "Settings/Inputs" tab, from where script users can change it. When a list of values is used with the `options` parameter, the value must be one of them.

title (const string) Title of the input. If not specified, the variable name is used as the input's title. If the title is specified, but it is empty, the name will be an empty string.

options (tuple of const int/float values: [val1, val2, ...]) A list of options to choose from a dropdown menu, separated by commas and enclosed in square brackets: [val1, val2, ...]. When using this parameter, the `minval`, `maxval` and `step` parameters cannot be used.

tooltip (const string) The string that will be shown to the user when hovering over the tooltip icon.

inline (const string) Combines all the input calls using the same argument in one line. The string used as an argument is not displayed. It is only used to identify inputs belonging to the same line.

group (const string) Creates a header above all inputs using the same group argument string. The string is also used as the header's text.

confirm (const bool) If true, then user will be asked to confirm input value before indicator is added to chart. Default value is false.

display (const plot\_display) Controls where the script will display the input's information, aside from within the script's settings. This option allows one to remove a specific input from the script's status line or the Data Window to ensure only the most necessary inputs are displayed there. Possible values: [display.none](#const_display.none), [display.data\_window](#const_display.data_window), [display.status\_line](#const_display.status_line), [display.all](#const_display.all). Optional. The default is [display.all](#const_display.all).

active (input bool) Optional. Specifies whether users can change the value of the input in the script's "Settings/Inputs" tab. The script can use this parameter to set the state of the input based on the values of other inputs. If [true](#const_true), users can change the value of the input. If [false](#const_false), the input is grayed out, and users cannot change the value. The default is [true](#const_true).

Example

```
//@version=6  
indicator("input.float", overlay=true)  
i_angle1 = input.float(0.5, "Sin Angle", minval=-3.14, maxval=3.14, step=0.02)  
plot(math.sin(i_angle1) > 0 ? close : open, "sin", color=color.green)  
  
i_angle2 = input.float(0, "Cos Angle", options=[-3.14, -1.57, 0, 1.57, 3.14])  
plot(math.cos(i_angle2) > 0 ? close : open, "cos", color=color.red)
```

Returns

Value of input variable.

Remarks

Result of [input.float](#fun_input.float) function always should be assigned to a variable, see examples above.

See also

[input.bool](#fun_input.bool)[input.int](#fun_input.int)[input.string](#fun_input.string)[input.text\_area](#fun_input.text_area)[input.symbol](#fun_input.symbol)[input.timeframe](#fun_input.timeframe)[input.session](#fun_input.session)[input.source](#fun_input.source)[input.color](#fun_input.color)[input.time](#fun_input.time)[input](#fun_input)
