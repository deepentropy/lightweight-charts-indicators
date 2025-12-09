### ta.cmo()

Chande Momentum Oscillator. Calculates the difference between the sum of recent gains and the sum of recent losses and then divides the result by the sum of all price movement over the same period.

Syntax

```
ta.cmo(series, length) → series float
```

Arguments

series (series int/float) Series of values to process.

length (series int) Number of bars (length).

Example

```
//@version=6  
indicator("ta.cmo")  
plot(ta.cmo(close, 5), color=color.yellow)  
  
// the same on pine  
f_cmo(src, length) =>  
    float mom = ta.change(src)  
    float sm1 = math.sum((mom >= 0) ? mom : 0.0, length)  
    float sm2 = math.sum((mom >= 0) ? 0.0 : -mom, length)  
    100 * (sm1 - sm2) / (sm1 + sm2)  
  
plot(f_cmo(close, 5))
```

Returns

Chande Momentum Oscillator.

Remarks

`na` values in the `source` series are ignored.

See also

[ta.rsi](#fun_ta.rsi)[ta.stoch](#fun_ta.stoch)[math.sum](#fun_math.sum)
