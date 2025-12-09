### matrix.set()

The function assigns `value` to the element at the `row` and `column` of the `id` matrix.

Syntax

```
matrix.set(id, row, column, value) → void
```

Arguments

id (any matrix type) A matrix object.

row (series int) The row index of the element to be modified.

column (series int) The column index of the element to be modified.

value (series <type of the matrix's elements>) The new value to be set.

Example

```
//@version=6  
indicator("`matrix.set()` Example")  
  
// Create a 2x3 "int" matrix containing values `4`.  
m = matrix.new<int>(2, 3, 4)  
  
// Replace the value of element at row 1 and column 2 with value `3`.  
matrix.set(m, 0, 1, 3)  
  
// Display using a label.  
if barstate.islastconfirmedhistory  
    label.new(bar_index, high, str.tostring(m))
```

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.get](#fun_matrix.get)[matrix.columns](#fun_matrix.columns)[matrix.rows](#fun_matrix.rows)
