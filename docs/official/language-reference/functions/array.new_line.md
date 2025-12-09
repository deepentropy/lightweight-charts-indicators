### array.new\_line()

The function creates a new array object of line type elements.

Syntax

```
array.new_line(size, initial_value) → array<line>
```

Arguments

size (series int) Initial size of an array. Optional. The default is 0.

initial\_value (series line) Initial value of all array elements. Optional. The default is 'na'.

Example

```
//@version=6  
indicator("array.new_line example")  
// draw last 15 lines  
var a = array.new_line()  
array.push(a, line.new(bar_index - 1, close[1], bar_index, close))  
if array.size(a) > 15  
    ln = array.shift(a)  
    line.delete(ln)
```

Returns

The ID of an array object which may be used in other array.\*() functions.

Remarks

An array index starts from 0.

See also

[array.new\_float](#fun_array.new_float)[array.get](#fun_array.get)[array.slice](#fun_array.slice)
