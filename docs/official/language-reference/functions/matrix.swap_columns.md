### matrix.swap\_columns()

The function swaps the columns at the index `column1` and `column2` in the `id` matrix.

Syntax

```
matrix.swap_columns(id, column1, column2) → void
```

Arguments

id (any matrix type) A matrix object.

column1 (series int) Index of the first column to be swapped.

column2 (series int) Index of the second column to be swapped.

Example

```
//@version=6  
indicator("`matrix.swap_columns()` Example")  
  
// For efficiency, execute this code only once.  
if barstate.islastconfirmedhistory  
    // Create a 2x2 matrix with ‘na’ values.  
    var m1 = matrix.new<int>(2, 2, na)  
    // Fill the matrix with values.  
    matrix.set(m1, 0, 0, 1)  
    matrix.set(m1, 0, 1, 2)  
    matrix.set(m1, 1, 0, 3)  
    matrix.set(m1, 1, 1, 4)  
  
    // Copy the matrix to a new one.  
    var m2 = matrix.copy(m1)  
  
    // Swap the first and second columns of the matrix copy.  
    matrix.swap_columns(m2, 0, 1)  
  
    // Display using a table.  
    var t = table.new(position.top_right, 2, 2, color.green)  
    table.cell(t, 0, 0, "Original matrix:")  
    table.cell(t, 0, 1, str.tostring(m1))  
    table.cell(t, 1, 0, "Swapped columns in copy:")  
    table.cell(t, 1, 1, str.tostring(m2))
```

Remarks

Indexing of the rows and columns starts at zero.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.get](#fun_matrix.get)[matrix.set](#fun_matrix.set)[matrix.columns](#fun_matrix.columns)[matrix.rows](#fun_matrix.rows)
