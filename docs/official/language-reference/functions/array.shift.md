### array.shift()

The function removes an array's first element and returns its value.

Syntax

```
array.shift(id) → series <type>
```

Arguments

id (any array type) An array object.

Example

```
//@version=6  
indicator("array.shift example")  
a = array.new_float(5,high)  
removedEl = array.shift(a)  
plot(array.size(a))  
plot(removedEl)
```

Returns

The value of the removed element.

See also

[array.unshift](#fun_array.unshift)[array.set](#fun_array.set)[array.push](#fun_array.push)[array.remove](#fun_array.remove)[array.includes](#fun_array.includes)
