### array.includes()

The function returns true if the value was found in an array, false otherwise.

Syntax

```
array.includes(id, value) → series bool
```

Arguments

id (any array type) An array object.

value (series <type of the array's elements>) The value to search in the array.

Example

```
//@version=6  
indicator("array.includes example")  
a = array.new_float(5,high)  
p = close  
if array.includes(a, high)  
    p := open  
plot(p)
```

Returns

True if the value was found in the array, false otherwise.

See also

[array.new\_float](#fun_array.new_float)[array.indexof](#fun_array.indexof)[array.shift](#fun_array.shift)[array.remove](#fun_array.remove)[array.insert](#fun_array.insert)
