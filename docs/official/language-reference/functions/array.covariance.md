### array.covariance()

The function returns the covariance of two arrays.

Syntax

```
array.covariance(id1, id2, biased) → series float
```

Arguments

id1 (array<int/float>) An array object.

id2 (array<int/float>) An array object.

biased (series bool) Determines which estimate should be used. Optional. The default is true.

Example

```
//@version=6  
indicator("array.covariance example")  
a = array.new_float(0)  
b = array.new_float(0)  
for i = 0 to 9  
    array.push(a, close[i])  
    array.push(b, open[i])  
plot(array.covariance(a, b))
```

Returns

The covariance of two arrays.

Remarks

If `biased` is [true](#const_true), function will calculate using a biased estimate of the entire population, if [false](#const_false) - unbiased estimate of a sample. Returns [na](#var_na) if both arrays are empty.

See also

[array.new\_float](#fun_array.new_float)[array.max](#fun_array.max)[array.stdev](#fun_array.stdev)[array.avg](#fun_array.avg)[array.variance](#fun_array.variance)
