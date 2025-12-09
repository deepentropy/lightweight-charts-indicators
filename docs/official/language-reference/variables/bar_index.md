### bar\_index

Current bar index. Numbering is zero-based, index of the first bar is 0.

Type

series int

Example

```
//@version=6  
indicator("bar_index")  
plot(bar_index)  
plot(bar_index > 5000 ? close : 0)
```

Remarks

Note that **bar\_index** has replaced **n** variable in version 4.

Note that bar indexing starts from 0 on the first historical bar.

Please note that using this variable/function can cause [indicator repainting](https://www.tradingview.com/pine-script-docs/concepts/repainting/).

See also

[last\_bar\_index](#var_last_bar_index)[barstate.isfirst](#var_barstate.isfirst)[barstate.islast](#var_barstate.islast)[barstate.isrealtime](#var_barstate.isrealtime)
