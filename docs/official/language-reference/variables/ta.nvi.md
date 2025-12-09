### ta.nvi

Negative Volume Index.

Type

series float

Example

```
//@version=6  
indicator("Negative Volume Index")  
  
plot(ta.nvi, color=color.yellow)  
  
// the same on pine  
f_nvi() =>  
    float ta_nvi = 1.0  
    float prevNvi = (nz(ta_nvi[1], 0.0) == 0.0) ? 1.0 : ta_nvi[1]  
    if nz(close, 0.0) == 0.0 or nz(close[1], 0.0) == 0.0  
        ta_nvi := prevNvi  
    else  
        ta_nvi := (volume < nz(volume[1], 0.0)) ? prevNvi + ((close - close[1]) / close[1]) * prevNvi : prevNvi  
    result = ta_nvi  
  
plot(f_nvi())
```
