### last\_bar\_index

Bar index of the last chart bar. Bar indices begin at zero on the first bar.

Type

series int

Example

```
//@version=6  
strategy("Mark Last X Bars For Backtesting", overlay = true, calc_on_every_tick = true)  
lastBarsFilterInput = input.int(100, "Bars Count:")  
// Here, we store the 'last_bar_index' value that is known from the beginning of the script's calculation.  
// The 'last_bar_index' will change when new real-time bars appear, so we declare 'lastbar' with the 'var' keyword.  
var lastbar = last_bar_index  
// Check if the current bar_index is 'lastBarsFilterInput' removed from the last bar on the chart, or the chart is traded in real-time.  
allowedToTrade = (lastbar - bar_index <= lastBarsFilterInput) or barstate.isrealtime  
bgcolor(allowedToTrade ? color.new(color.green, 80) : na)
```

Returns

Last historical bar index for closed markets, or the real-time bar index for open markets.

Remarks

Please note that using this variable can cause [indicator repainting](https://www.tradingview.com/pine-script-docs/concepts/repainting/).

See also

[bar\_index](#var_bar_index)[last\_bar\_time](#var_last_bar_time)[barstate.ishistory](#var_barstate.ishistory)[barstate.isrealtime](#var_barstate.isrealtime)
