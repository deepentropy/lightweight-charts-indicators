### array.sum()

2 overloads

The function returns the sum of an array's elements.

Syntax & Overloads

[```
array.sum(id) → series float
```](#fun_array.sum-0)[```
array.sum(id) → series int
```](#fun_array.sum-1)

Arguments

id (array<int/float>) An array object.

Example

```
//@version=6  
indicator("array.sum example")  
a = array.new_float(0)  
for i = 0 to 9  
    array.push(a, close[i])  
plot(array.sum(a))
```

Returns

The sum of the array's elements.

Remarks

Returns [na](#var_na) if the `id` array is empty.

See also

[array.new\_float](#fun_array.new_float)[array.max](#fun_array.max)[array.min](#fun_array.min)
