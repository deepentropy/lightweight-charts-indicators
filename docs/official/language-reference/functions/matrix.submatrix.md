### matrix.submatrix()

The function extracts a submatrix of the `id` matrix within the specified indices.

Syntax

```
matrix.submatrix(id, from_row, to_row, from_column, to_column) → matrix<type>
```

Arguments

id (any matrix type) A matrix object.

from\_row (series int) Index of the row from which the extraction will begin (inclusive). Optional. The default value is 0.

to\_row (series int) Index of the row where the extraction will end (non inclusive). Optional. The default value is [matrix.rows](#fun_matrix.rows).

from\_column (series int) Index of the column from which the extraction will begin (inclusive). Optional. The default value is 0.

to\_column (series int) Index of the column where the extraction will end (non inclusive). Optional. The default value is [matrix.columns](#fun_matrix.columns).

Example

```
//@version=6  
indicator("`matrix.submatrix()` Example")  
  
// For efficiency, execute this code only once.  
if barstate.islastconfirmedhistory  
    // Create a 2x3 matrix matrix with values `0`.  
    var m1 = matrix.new<int>(2, 3, 0)  
    // Fill the matrix with values.  
    matrix.set(m1, 0, 0, 1)  
    matrix.set(m1, 0, 1, 2)  
    matrix.set(m1, 0, 2, 3)  
    matrix.set(m1, 1, 0, 4)  
    matrix.set(m1, 1, 1, 5)  
    matrix.set(m1, 1, 2, 6)  
  
    // Create a 2x2 submatrix of the `m1` matrix.  
    var m2 = matrix.submatrix(m1, 0, 2, 1, 3)  
  
    // Display using a table.  
    var t = table.new(position.top_right, 2, 2, color.green)  
    table.cell(t, 0, 0, "Original Matrix:")  
    table.cell(t, 0, 1, str.tostring(m1))  
    table.cell(t, 1, 0, "Submatrix:")  
    table.cell(t, 1, 1, str.tostring(m2))
```

Returns

A new matrix object containing the submatrix of the `id` matrix defined by the `from_row`, `to_row`, `from_column` and `to_column` indices.

Remarks

Indexing of the rows and columns starts at zero.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.set](#fun_matrix.set)[matrix.row](#fun_matrix.row)[matrix.col](#fun_matrix.col)[matrix.reshape](#fun_matrix.reshape)
