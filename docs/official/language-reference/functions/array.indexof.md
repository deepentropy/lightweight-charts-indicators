### array.indexof()

The function returns the index of the first occurrence of the value, or -1 if the value is not found.

Syntax

```
array.indexof(id, value) → series int
```

Arguments

id (any array type) An array object.

value (series <type of the array's elements>) The value to search in the array.

Example

```
//@version=6  
indicator("array.indexof example")  
a = array.new_float(5,high)  
index = array.indexof(a, high)  
plot(index)
```

Returns

The index of an element.

See also

[array.lastindexof](#fun_array.lastindexof)[array.get](#fun_array.get)[array.lastindexof](#fun_array.lastindexof)[array.remove](#fun_array.remove)[array.insert](#fun_array.insert)
