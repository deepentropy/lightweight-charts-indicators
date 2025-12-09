### alertcondition()

Creates alert condition, that is available in Create Alert dialog. Please note, that [alertcondition](#fun_alertcondition) does NOT create an alert, it just gives you more options in Create Alert dialog. Also, [alertcondition](#fun_alertcondition) effect is invisible on chart.

Syntax

```
alertcondition(condition, title, message) → void
```

Arguments

condition (series bool) Series of boolean values that is used for alert. True values mean alert fire, false - no alert. Required argument.

title (const string) Title of the alert condition. Optional argument.

message (const string) Message to display when alert fires. Optional argument.

Example

```
//@version=6  
indicator("alertcondition", overlay=true)  
alertcondition(close >= open, title='Alert on Green Bar', message='Green Bar!')
```

Remarks

Please note that an alertcondition call generates an additional plot. All such calls are taken into account when we calculate the number of the output series per script.

See also

[alert](#fun_alert)
