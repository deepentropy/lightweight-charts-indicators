### array.max()

2 overloads

The function returns the greatest value, or the nth greatest value in a given array.

Syntax & Overloads

[```
array.max(id, nth) → series float
```](#fun_array.max-0)[```
array.max(id, nth) → series int
```](#fun_array.max-1)

Arguments

id (array<int/float>) An array object.

nth (series int) The nth greatest value to return, where zero is the greatest. Optional. The default is zero.

Example

```
//@version=6  
indicator("array.max")  
a = array.from(5, -2, 0, 9, 1)  
thirdHighest = array.max(a, 2) // 1  
plot(thirdHighest)
```

Returns

The greatest or the nth greatest value in the array.

Remarks

Returns [na](#var_na) if the `id` array is empty.

See also

[array.new\_float](#fun_array.new_float)[array.min](#fun_array.min)[array.sum](#fun_array.sum)
