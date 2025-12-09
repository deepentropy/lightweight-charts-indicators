### array.insert()

The function changes the contents of an array by adding new elements in place.

Syntax

```
array.insert(id, index, value) → void
```

Arguments

id (any array type) An array object.

index (series int) The index at which to insert the value.

value (series <type of the array's elements>) The value to add to the array.

Example

```
//@version=6  
indicator("array.insert example")  
a = array.new_float(5, close)  
array.insert(a, 0, open)  
plot(array.get(a, 5))
```

Remarks

If the index is positive, the function counts forwards from the beginning of the array to the end. The index of the first element is 0, and the index of the last element is `array.size() - 1`. If the index is negative, the function counts backwards from the end of the array to the beginning. In this case, the index of the last element is -1, and the index of the first element is negative `array.size()`. For example, for an array that contains three elements, all of the following are valid arguments for the `index` parameter: 0, 1, 2, -1, -2, -3.

See also

[array.new\_float](#fun_array.new_float)[array.set](#fun_array.set)[array.push](#fun_array.push)[array.remove](#fun_array.remove)[array.pop](#fun_array.pop)[array.unshift](#fun_array.unshift)
