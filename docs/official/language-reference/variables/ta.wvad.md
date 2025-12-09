### ta.wvad

Williams Variable Accumulation/Distribution.

Type

series float

Example

```
//@version=6  
indicator("Williams Variable Accumulation/Distribution")  
plot(ta.wvad, color=color.yellow)  
  
// the same on pine  
f_wvad() =>  
    (close - open) / (high - low) * volume  
  
plot(f_wvad())
```
