### array.lastindexof()

The function returns the index of the last occurrence of the value, or -1 if the value is not found.

Syntax

```
array.lastindexof(id, value) → series int
```

Arguments

id (any array type) An array object.

value (series <type of the array's elements>) The value to search in the array.

Example

```
//@version=6  
indicator("array.lastindexof example")  
a = array.new_float(5,high)  
index = array.lastindexof(a, high)  
plot(index)
```

Returns

The index of an element.

See also

[array.new\_float](#fun_array.new_float)[array.set](#fun_array.set)[array.push](#fun_array.push)[array.remove](#fun_array.remove)[array.insert](#fun_array.insert)
