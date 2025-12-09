### ta.pvi

Positive Volume Index.

Type

series float

Example

```
//@version=6  
indicator("Positive Volume Index")  
  
plot(ta.pvi, color=color.yellow)  
  
// the same on pine  
f_pvi() =>  
    float ta_pvi = 1.0  
    float prevPvi = (nz(ta_pvi[1], 0.0) == 0.0) ? 1.0 : ta_pvi[1]  
    if nz(close, 0.0) == 0.0 or nz(close[1], 0.0) == 0.0  
        ta_pvi := prevPvi  
    else  
        ta_pvi := (volume > nz(volume[1], 0.0)) ? prevPvi + ((close - close[1]) / close[1]) * prevPvi : prevPvi  
    result = ta_pvi  
  
plot(f_pvi())
```
