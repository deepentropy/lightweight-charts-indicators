### input.session()

Adds an input to the Inputs tab of your script's Settings, which allows you to provide configuration options to script users. This function adds two dropdowns that allow the user to specify the beginning and the end of a session using the session selector and returns the result as a string.

Syntax

```
input.session(defval, title, options, tooltip, inline, group, confirm, display, active) → input string
```

Arguments

defval (const string) Determines the default value of the input variable proposed in the script's "Settings/Inputs" tab, from where the user can change it. When a list of values is used with the `options` parameter, the value must be one of them.

title (const string) Title of the input. If not specified, the variable name is used as the input's title. If the title is specified, but it is empty, the name will be an empty string.

options (tuple of const string values: [val1, val2, ...]) A list of options to choose from.

tooltip (const string) The string that will be shown to the user when hovering over the tooltip icon.

inline (const string) Combines all the input calls using the same argument in one line. The string used as an argument is not displayed. It is only used to identify inputs belonging to the same line.

group (const string) Creates a header above all inputs using the same group argument string. The string is also used as the header's text.

confirm (const bool) If true, then user will be asked to confirm input value before indicator is added to chart. Default value is false.

display (const plot\_display) Controls where the script will display the input's information, aside from within the script's settings. This option allows one to remove a specific input from the script's status line or the Data Window to ensure only the most necessary inputs are displayed there. Possible values: [display.none](#const_display.none), [display.data\_window](#const_display.data_window), [display.status\_line](#const_display.status_line), [display.all](#const_display.all). Optional. The default is [display.all](#const_display.all).

active (input bool) Optional. Specifies whether users can change the value of the input in the script's "Settings/Inputs" tab. The script can use this parameter to set the state of the input based on the values of other inputs. If [true](#const_true), users can change the value of the input. If [false](#const_false), the input is grayed out, and users cannot change the value. The default is [true](#const_true).

Example

```
//@version=6  
indicator("input.session", overlay=true)  
i_sess = input.session("1300-1700", "Session", options=["0930-1600", "1300-1700", "1700-2100"])  
t = time(timeframe.period, i_sess)  
bgcolor(time == t ? color.green : na)
```

Returns

Value of input variable.

Remarks

Result of [input.session](#fun_input.session) function always should be assigned to a variable, see examples above.

See also

[input.bool](#fun_input.bool)[input.int](#fun_input.int)[input.float](#fun_input.float)[input.string](#fun_input.string)[input.text\_area](#fun_input.text_area)[input.symbol](#fun_input.symbol)[input.timeframe](#fun_input.timeframe)[input.source](#fun_input.source)[input.color](#fun_input.color)[input.time](#fun_input.time)[input](#fun_input)
