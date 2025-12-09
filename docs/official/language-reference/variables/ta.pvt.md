### ta.pvt

Price-Volume Trend.

Type

series float

Example

```
//@version=6  
indicator("Price-Volume Trend")  
plot(ta.pvt, color=color.yellow)  
  
// the same on pine  
f_pvt() =>  
    ta.cum((ta.change(close) / close[1]) * volume)  
  
plot(f_pvt())
```
