### ta.pivot\_point\_levels()

Calculates the pivot point levels using the specified `type` and `anchor`.

Syntax

```
ta.pivot_point_levels(type, anchor, developing) → array<float>
```

Arguments

type (series string) The type of pivot point levels. Possible values: "Traditional", "Fibonacci", "Woodie", "Classic", "DM", "Camarilla".

anchor (series bool) The condition that triggers the reset of the pivot point calculations. When [true](#const_true), calculations reset; when [false](#const_false), results calculated at the last reset persist.

developing (series bool) If [false](#const_false), the values are those calculated the last time the anchor condition was [true](#const_true). They remain constant until the anchor condition becomes [true](#const_true) again. If [true](#const_true), the pivots are developing, i.e., they constantly recalculate on the data developing between the point of the last anchor (or bar zero if the anchor condition was never [true](#const_true)) and the current bar. Optional. The default is [false](#const_false).

Example

```
//@version=6  
indicator("Weekly Pivots", max_lines_count=500, overlay=true)  
timeframe = "1W"  
typeInput = input.string("Traditional", "Type", options=["Traditional", "Fibonacci", "Woodie", "Classic", "DM", "Camarilla"])  
weekChange = timeframe.change(timeframe)  
pivotPointsArray = ta.pivot_point_levels(typeInput, weekChange)  
if weekChange  
    for pivotLevel in pivotPointsArray  
        line.new(time, pivotLevel, time + timeframe.in_seconds(timeframe) * 1000, pivotLevel, xloc=xloc.bar_time)
```

Returns

An `array<float>` with numerical values representing 11 pivot point levels: [P, R1, S1, R2, S2, R3, S3, R4, S4, R5, S5]. Levels absent from the specified `type` return [na](#var_na) values (e.g., "DM" only calculates P, R1, and S1).

Remarks

The `developing` parameter cannot be `true` when `type` is set to "Woodie", because the Woodie calculation for a period depends on that period's open, which means that the pivot value is either available or unavailable, but never developing. If used together, the indicator will return a runtime error.
