### array.new\_float()

The function creates a new array object of float type elements.

Syntax

```
array.new_float(size, initial_value) → array<float>
```

Arguments

size (series int) Initial size of an array. Optional. The default is 0.

initial\_value (series int/float) Initial value of all array elements. Optional. The default is 'na'.

Example

```
//@version=6  
indicator("array.new_float example")  
length = 5  
a = array.new_float(length, close)  
plot(array.sum(a) / length)
```

Returns

The ID of an array object which may be used in other array.\*() functions.

Remarks

An array index starts from 0.

See also

[array.new\_color](#fun_array.new_color)[array.new\_bool](#fun_array.new_bool)[array.get](#fun_array.get)[array.slice](#fun_array.slice)[array.sort](#fun_array.sort)
