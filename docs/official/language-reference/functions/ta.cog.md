### ta.cog()

The cog (center of gravity) is an indicator based on statistics and the Fibonacci golden ratio.

Syntax

```
ta.cog(source, length) → series float
```

Arguments

source (series int/float) Series of values to process.

length (series int) Number of bars (length).

Example

```
//@version=6  
indicator("ta.cog", overlay=true)  
plot(ta.cog(close, 10))  
  
// the same on pine  
pine_cog(source, length) =>  
    sum = math.sum(source, length)  
    num = 0.0  
    for i = 0 to length - 1  
        price = source[i]  
        num := num + price * (i + 1)  
    -num / sum  
  
plot(pine_cog(close, 10))
```

Returns

Center of Gravity.

Remarks

`na` values in the `source` series are ignored.

See also

[ta.stoch](#fun_ta.stoch)
