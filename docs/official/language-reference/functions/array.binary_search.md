### array.binary\_search()

The function returns the index of the value, or -1 if the value is not found. The array to search must be sorted in ascending order.

Syntax

```
array.binary_search(id, val) → series int
```

Arguments

id (array<int/float>) An array object.

val (series int/float) The value to search for in the array.

Example

```
//@version=6  
indicator("array.binary_search")  
a = array.from(5, -2, 0, 9, 1)  
array.sort(a) // [-2, 0, 1, 5, 9]  
position = array.binary_search(a, 0) // 1  
plot(position)
```

Remarks

A binary search works on arrays pre-sorted in ascending order. It begins by comparing an element in the middle of the array with the target value. If the element matches the target value, its position in the array is returned. If the element's value is greater than the target value, the search continues in the lower half of the array. If the element's value is less than the target value, the search continues in the upper half of the array. By doing this recursively, the algorithm progressively eliminates smaller and smaller portions of the array in which the target value cannot lie.

See also

[array.new\_float](#fun_array.new_float)[array.insert](#fun_array.insert)[array.slice](#fun_array.slice)[array.reverse](#fun_array.reverse)[order.ascending](#const_order.ascending)[order.descending](#const_order.descending)
