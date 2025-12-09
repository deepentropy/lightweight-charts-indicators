### array.size()

The function returns the number of elements in an array.

Syntax

```
array.size(id) → series int
```

Arguments

id (any array type) An array object.

Example

```
//@version=6  
indicator("array.size example")  
a = array.new_float(0)  
for i = 0 to 9  
    array.push(a, close[i])  
// note that changes in slice also modify original array  
slice = array.slice(a, 0, 5)  
array.push(slice, open)  
// size was changed in slice and in original array  
plot(array.size(a))  
plot(array.size(slice))
```

Returns

The number of elements in the array.

See also

[array.new\_float](#fun_array.new_float)[array.sum](#fun_array.sum)[array.slice](#fun_array.slice)[array.sort](#fun_array.sort)
