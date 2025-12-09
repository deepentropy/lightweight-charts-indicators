### array.median()

2 overloads

The function returns the median of an array's elements.

Syntax & Overloads

[```
array.median(id) → series float
```](#fun_array.median-0)[```
array.median(id) → series int
```](#fun_array.median-1)

Arguments

id (array<int/float>) An array object.

Example

```
//@version=6  
indicator("array.median example")  
a = array.new_float(0)  
for i = 0 to 9  
    array.push(a, close[i])  
plot(array.median(a))
```

Returns

The median of the array's elements.

Remarks

Returns [na](#var_na) if the `id` array is empty.

See also

[array.median](#fun_array.median)[array.avg](#fun_array.avg)[array.variance](#fun_array.variance)[array.min](#fun_array.min)
