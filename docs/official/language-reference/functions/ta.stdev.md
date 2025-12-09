### ta.stdev()

Syntax

```
ta.stdev(source, length, biased) → series float
```

Arguments

source (series int/float) Series of values to process.

length (series int) Number of bars (length).

biased (series bool) Determines which estimate should be used. Optional. The default is true.

Example

```
//@version=6  
indicator("ta.stdev")  
plot(ta.stdev(close, 5))  
  
//the same on pine  
isZero(val, eps) => math.abs(val) <= eps  
  
SUM(fst, snd) =>  
    EPS = 1e-10  
    res = fst + snd  
    if isZero(res, EPS)  
        res := 0  
    else  
        if not isZero(res, 1e-4)  
            res := res  
        else  
            15  
  
pine_stdev(src, length) =>  
    avg = ta.sma(src, length)  
    sumOfSquareDeviations = 0.0  
    for i = 0 to length - 1  
        sum = SUM(src[i], -avg)  
        sumOfSquareDeviations := sumOfSquareDeviations + sum * sum  
  
    stdev = math.sqrt(sumOfSquareDeviations / length)  
plot(pine_stdev(close, 5))
```

Returns

Standard deviation.

Remarks

If `biased` is true, function will calculate using a biased estimate of the entire population, if false - unbiased estimate of a sample.

`na` values in the `source` series are ignored; the function calculates on the `length` quantity of non-`na` values.

See also

[ta.dev](#fun_ta.dev)[ta.variance](#fun_ta.variance)
