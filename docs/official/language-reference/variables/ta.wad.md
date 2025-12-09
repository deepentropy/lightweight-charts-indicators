### ta.wad

Williams Accumulation/Distribution.

Type

series float

Example

```
//@version=6  
indicator("Williams Accumulation/Distribution")  
plot(ta.wad, color=color.yellow)  
  
// the same on pine  
f_wad() =>  
    trueHigh = math.max(high, close[1])  
    trueLow = math.min(low, close[1])  
    mom = ta.change(close)  
    gain = (mom > 0) ? close - trueLow : (mom < 0) ? close - trueHigh : 0  
    ta.cum(gain)  
  
plot(f_wad())
```
