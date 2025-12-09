### array.new\_int()

The function creates a new array object of int type elements.

Syntax

```
array.new_int(size, initial_value) → array<int>
```

Arguments

size (series int) Initial size of an array. Optional. The default is 0.

initial\_value (series int) Initial value of all array elements. Optional. The default is 'na'.

Example

```
//@version=6  
indicator("array.new_int example")  
length = 5  
a = array.new_int(length, int(close))  
plot(array.sum(a) / length)
```

Returns

The ID of an array object which may be used in other array.\*() functions.

Remarks

An array index starts from 0.

See also

[array.new\_float](#fun_array.new_float)[array.get](#fun_array.get)[array.slice](#fun_array.slice)[array.sort](#fun_array.sort)
