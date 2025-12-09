### array.new\_table()

The function creates a new array object of table type elements.

Syntax

```
array.new_table(size, initial_value) → array<table>
```

Arguments

size (series int) Initial size of an array. Optional. The default is 0.

initial\_value (series table) Initial value of all array elements. Optional. The default is 'na'.

Example

```
//@version=6  
indicator("table array")  
tables = array.new_table()  
array.push(tables, table.new(position = position.top_left, rows = 1, columns = 2, bgcolor = color.yellow, border_width=1))  
plot(1)
```

Returns

The ID of an array object which may be used in other array.\*() functions.

Remarks

An array index starts from 0.

See also

[array.new\_float](#fun_array.new_float)[array.get](#fun_array.get)[array.slice](#fun_array.slice)
