### array.range()

2 overloads

The function returns the difference between the min and max values from a given array.

Syntax & Overloads

[```
array.range(id) → series float
```](#fun_array.range-0)[```
array.range(id) → series int
```](#fun_array.range-1)

Arguments

id (array<int/float>) An array object.

Example

```
//@version=6  
indicator("array.range example")  
a = array.new_float(0)  
for i = 0 to 9  
    array.push(a, close[i])  
plot(array.range(a))
```

Returns

The difference between the min and max values in the array.

Remarks

Returns [na](#var_na) if the `id` array is empty.

See also

[array.new\_float](#fun_array.new_float)[array.min](#fun_array.min)[array.max](#fun_array.max)[array.sum](#fun_array.sum)
