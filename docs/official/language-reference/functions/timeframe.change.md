### timeframe.change()

Detects changes in the specified `timeframe`.

Syntax

```
timeframe.change(timeframe) → series bool
```

Arguments

timeframe (series string) String formatted according to the [User manual's timeframe string specifications](https://www.tradingview.com/pine-script-docs/concepts/timeframes/#timeframe-string-specifications).

Example

```
//@version=6  
// Run this script on an intraday chart.  
indicator("New day started", overlay = true)  
// Highlights the first bar of the new day.  
isNewDay = timeframe.change("1D")  
bgcolor(isNewDay ? color.new(color.green, 80) : na)
```

Returns

Returns [true](#const_true) on the first bar of a new `timeframe`, [false](#const_false) otherwise.
