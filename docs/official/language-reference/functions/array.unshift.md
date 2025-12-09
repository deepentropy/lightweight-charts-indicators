### array.unshift()

The function inserts the value at the beginning of the array.

Syntax

```
array.unshift(id, value) → void
```

Arguments

id (any array type) An array object.

value (series <type of the array's elements>) The value to add to the start of the array.

Example

```
//@version=6  
indicator("array.unshift example")  
a = array.new_float(5, 0)  
array.unshift(a, open)  
plot(array.get(a, 0))
```

See also

[array.shift](#fun_array.shift)[array.set](#fun_array.set)[array.insert](#fun_array.insert)[array.remove](#fun_array.remove)[array.indexof](#fun_array.indexof)
