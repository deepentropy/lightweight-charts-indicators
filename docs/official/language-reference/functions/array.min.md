### array.min()

2 overloads

The function returns the smallest value, or the nth smallest value in a given array.

Syntax & Overloads

[```
array.min(id, nth) → series float
```](#fun_array.min-0)[```
array.min(id, nth) → series int
```](#fun_array.min-1)

Arguments

id (array<int/float>) An array object.

nth (series int) The nth smallest value to return, where zero is the smallest. Optional. The default is zero.

Example

```
//@version=6  
indicator("array.min")  
a = array.from(5, -2, 0, 9, 1)  
secondLowest = array.min(a, 1) // 0  
plot(secondLowest)
```

Returns

The smallest or the nth smallest value in the array.

Remarks

Returns [na](#var_na) if the `id` array is empty.

See also

[array.new\_float](#fun_array.new_float)[array.max](#fun_array.max)[array.sum](#fun_array.sum)
