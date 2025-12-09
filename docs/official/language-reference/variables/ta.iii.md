### ta.iii

Intraday Intensity Index.

Type

series float

Example

```
//@version=6  
indicator("Intraday Intensity Index")  
plot(ta.iii, color=color.yellow)  
  
// the same on pine  
f_iii() =>  
    (2 * close - high - low) / ((high - low) * volume)  
  
plot(f_iii())
```
