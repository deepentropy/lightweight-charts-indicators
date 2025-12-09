### array.new\_bool()

The function creates a new array object of bool type elements.

Syntax

```
array.new_bool(size, initial_value) → array<bool>
```

Arguments

size (series int) Initial size of an array. Optional. The default is 0.

initial\_value (series bool) Initial value of all array elements. Optional. The default is 'false'.

Example

```
//@version=6  
indicator("array.new_bool example")  
length = 5  
a = array.new_bool(length, close > open)  
plot(array.get(a, 0) ? close : open)
```

Returns

The ID of an array object which may be used in other array.\*() functions.

Remarks

An array index starts from 0.

See also

[array.new\_float](#fun_array.new_float)[array.get](#fun_array.get)[array.slice](#fun_array.slice)[array.sort](#fun_array.sort)
