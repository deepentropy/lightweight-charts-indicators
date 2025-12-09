### array.copy()

The function creates a copy of an existing array.

Syntax

```
array.copy(id) → array<type>
```

Arguments

id (any array type) An array object.

Example

```
//@version=6  
indicator("array.copy example")  
length = 5  
a = array.new_float(length, close)  
b = array.copy(a)  
a := array.new_float(length, open)  
plot(array.sum(a) / length)  
plot(array.sum(b) / length)
```

Returns

A copy of an array.

See also

[array.new\_float](#fun_array.new_float)[array.get](#fun_array.get)[array.slice](#fun_array.slice)[array.sort](#fun_array.sort)
