### array.pop()

The function removes the last element from an array and returns its value.

Syntax

```
array.pop(id) → series <type>
```

Arguments

id (any array type) An array object.

Example

```
//@version=6  
indicator("array.pop example")  
a = array.new_float(5,high)  
removedEl = array.pop(a)  
plot(array.size(a))  
plot(removedEl)
```

Returns

The value of the removed element.

See also

[array.new\_float](#fun_array.new_float)[array.set](#fun_array.set)[array.push](#fun_array.push)[array.remove](#fun_array.remove)[array.insert](#fun_array.insert)[array.shift](#fun_array.shift)
