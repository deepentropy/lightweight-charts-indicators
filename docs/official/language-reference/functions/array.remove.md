### array.remove()

The function changes the contents of an array by removing the element with the specified index.

Syntax

```
array.remove(id, index) → series <type>
```

Arguments

id (any array type) An array object.

index (series int) The index of the element to remove.

Example

```
//@version=6  
indicator("array.remove example")  
a = array.new_float(5,high)  
removedEl = array.remove(a, 0)  
plot(array.size(a))  
plot(removedEl)
```

Returns

The value of the removed element.

Remarks

If the index is positive, the function counts forwards from the beginning of the array to the end. The index of the first element is 0, and the index of the last element is `array.size() - 1`. If the index is negative, the function counts backwards from the end of the array to the beginning. In this case, the index of the last element is -1, and the index of the first element is negative `array.size()`. For example, for an array that contains three elements, all of the following are valid arguments for the `index` parameter: 0, 1, 2, -1, -2, -3.

See also

[array.new\_float](#fun_array.new_float)[array.set](#fun_array.set)[array.push](#fun_array.push)[array.insert](#fun_array.insert)[array.pop](#fun_array.pop)[array.shift](#fun_array.shift)
