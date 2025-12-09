### matrix.add\_row()

Inserts a new row at the `row` index of the `id` matrix.

Syntax

```
matrix.add_row(id, row, array_id) → void
```

Arguments

id (any matrix type) The matrix object's ID (reference).

row (series int) Optional. The index of the new row. Must be a value from 0 to `matrix.rows(id)`. All existing rows with indices that are greater than or equal to this value increase their index by one. The default is `matrix.rows(id)`.

array\_id (any array type) Optional. The ID of an array to use as the new row. If the matrix is empty, the array can be of any size. Otherwise, its size must equal `matrix.columns(id)`. By default, the function inserts a row of [na](#var_na) values.

Adding a row to the matrix

Example

```
//@version=6  
indicator("`matrix.add_row()` Example 1")  
  
// Create a 2x3 "int" matrix containing values `0`.  
m = matrix.new<int>(2, 3, 0)  
  
// Add a row with `na` values to the matrix.  
matrix.add_row(m)  
  
// Display matrix elements.  
if barstate.islastconfirmedhistory  
    var t = table.new(position.top_right, 2, 2, color.green)  
    table.cell(t, 0, 0, "Matrix elements:")  
    table.cell(t, 0, 1, str.tostring(m))
```

Adding an array as a row to the matrix

Example

```
//@version=6  
indicator("`matrix.add_row()` Example 2")  
  
if barstate.islastconfirmedhistory  
    // Create an empty matrix object.  
    var m = matrix.new<int>()  
  
    // Create an array with values `1` and `2`.  
    var a = array.from(1, 2)  
  
    // Add the `a` array as the first row of the empty matrix.  
    matrix.add_row(m, 0, a)  
  
    // Display matrix elements.  
    var t = table.new(position.top_right, 2, 2, color.green)  
    table.cell(t, 0, 0, "Matrix elements:")  
    table.cell(t, 0, 1, str.tostring(m))
```

Remarks

Indexing of rows and columns starts at zero. Rather than add rows to an empty matrix, it is far more efficient to declare a matrix with explicit dimensions and fill it with values.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.get](#fun_matrix.get)[matrix.set](#fun_matrix.set)[matrix.columns](#fun_matrix.columns)[matrix.rows](#fun_matrix.rows)[matrix.add\_col](#fun_matrix.add_col)
