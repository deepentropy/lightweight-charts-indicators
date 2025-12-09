### alert()

Creates an alert trigger for an indicator or strategy, with a specified frequency, when called on the latest realtime bar. To activate alerts for a script containing calls to this function, open the "Create Alert" dialog box, then select the script name and "Any alert() function call" in the "Condition" section.

Syntax

```
alert(message, freq) → void
```

Arguments

message (series string) The message to send when the alert occurs.

freq (input string) Optional. Determines the allowed frequency of the alert trigger. Possible values are: [alert.freq\_all](#const_alert.freq_all) (allows an alert on any realtime update), [alert.freq\_once\_per\_bar](#const_alert.freq_once_per_bar) (allows an alert only on the first execution for each realtime bar), or [alert.freq\_once\_per\_bar\_close](#const_alert.freq_once_per_bar_close) (allows an alert only when a realtime bar closes). The default is [alert.freq\_once\_per\_bar](#const_alert.freq_once_per_bar).

Example

```
//@version=6  
indicator("`alert()` example", "", true)  
ma = ta.sma(close, 14)  
xUp = ta.crossover(close, ma)  
if xUp  
    // Trigger the alert the first time a cross occurs during the real-time bar.  
    alert("Price (" + str.tostring(close) + ") crossed over MA (" + str.tostring(ma) + ").", alert.freq_once_per_bar)  
plot(ma)  
plotchar(xUp, "xUp", "▲", location.top, size = size.tiny)
```

Remarks

The `alert()` function does not display information on the chart.

In contrast to [alertcondition](#fun_alertcondition), calls to this function do not count toward a script's plot count. Additionally, `alert()` calls are allowed in local scopes, including the scopes of exported library functions.

See [this article](https://www.tradingview.com/chart/?solution=43000597494) in our Help Center to learn more about activating alerts from `alert()` calls.

See also

[alertcondition](#fun_alertcondition)
