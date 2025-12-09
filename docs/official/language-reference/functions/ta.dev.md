### ta.dev()

Measure of difference between the series and it's [ta.sma](#fun_ta.sma)

Syntax

```
ta.dev(source, length) → series float
```

Arguments

source (series int/float) Series of values to process.

length (series int) Number of bars (length).

Example

```
//@version=6  
indicator("ta.dev")  
plot(ta.dev(close, 10))  
  
// the same on pine  
pine_dev(source, length) =>  
    mean = ta.sma(source, length)  
    sum = 0.0  
    for i = 0 to length - 1  
        val = source[i]  
        sum := sum + math.abs(val - mean)  
    dev = sum/length  
plot(pine_dev(close, 10))
```

Returns

Deviation of `source` for `length` bars back.

Remarks

`na` values in the `source` series are ignored.

See also

[ta.variance](#fun_ta.variance)[ta.stdev](#fun_ta.stdev)
