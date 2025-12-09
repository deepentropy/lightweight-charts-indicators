### array.slice()

The function creates a slice from an existing array. If an object from the slice changes, the changes are applied to both the new and the original arrays.

Syntax

```
array.slice(id, index_from, index_to) → array<type>
```

Arguments

id (any array type) An array object.

index\_from (series int) Zero-based index at which to begin extraction.

index\_to (series int) Zero-based index before which to end extraction. The function extracts up to but not including the element with this index.

Example

```
//@version=6  
indicator("array.slice example")  
a = array.new_float(0)  
for i = 0 to 9  
    array.push(a, close[i])  
// take elements from 0 to 4  
// *note that changes in slice also modify original array  
slice = array.slice(a, 0, 5)  
plot(array.sum(a) / 10)  
plot(array.sum(slice) / 5)
```

Returns

A shallow copy of an array's slice.

See also

[array.new\_float](#fun_array.new_float)[array.get](#fun_array.get)[array.slice](#fun_array.slice)[array.sort](#fun_array.sort)
