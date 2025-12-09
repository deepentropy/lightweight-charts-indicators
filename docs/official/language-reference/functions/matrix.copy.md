### matrix.copy()

The function creates a new matrix which is a copy of the original.

Syntax

```
matrix.copy(id) → matrix<type>
```

Arguments

id (any matrix type) A matrix object to copy.

Example

```
//@version=6  
indicator("`matrix.copy()` Example")  
  
// For efficiency, execute this code only once.  
if barstate.islastconfirmedhistory  
    // Create a 2x3 "float" matrix with `1` values.  
    var m1 = matrix.new<float>(2, 3, 1)  
  
    // Copy the matrix to a new one.  
    // Note that unlike what `matrix.copy()` does,  
    // the simple assignment operation `m2 = m1`  
    // would NOT create a new copy of the `m1` matrix.  
    // It would merely create a copy of its ID referencing the same matrix.  
    var m2 = matrix.copy(m1)  
  
    // Display using a table.  
    var t = table.new(position.top_right, 5, 2, color.green)  
    table.cell(t, 0, 0, "Original Matrix:")  
    table.cell(t, 0, 1, str.tostring(m1))  
    table.cell(t, 1, 0, "Matrix Copy:")  
    table.cell(t, 1, 1, str.tostring(m2))
```

Returns

A new matrix object of the copied `id` matrix.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.get](#fun_matrix.get)[matrix.set](#fun_matrix.set)[matrix.columns](#fun_matrix.columns)[matrix.rows](#fun_matrix.rows)
