### matrix.remove\_row()

The function removes the row at `row` index of the `id` matrix and returns an array containing the removed row's values.

Syntax

```
matrix.remove_row(id, row) → array<type>
```

Arguments

id (any matrix type) A matrix object.

row (series int) The index of the row to be deleted. Optional. The default value is [matrix.rows](#fun_matrix.rows).

Example

```
//@version=6  
indicator("matrix_remove_row", overlay = true)  
  
// Create a 2x2 "int" matrix containing values `1`.  
var matrixOrig = matrix.new<int>(2, 2, 1)  
  
// Set values to the 'matrixOrig' matrix.  
matrix.set(matrixOrig, 0, 1, 2)  
matrix.set(matrixOrig, 1, 0, 3)  
matrix.set(matrixOrig, 1, 1, 4)  
  
// Create a copy of the 'matrixOrig' matrix.  
matrixCopy = matrix.copy(matrixOrig)  
  
// Remove the first row from the matrix `matrixCopy`.  
arr = matrix.remove_row(matrixCopy, 0)  
  
// Display matrix elements.  
if barstate.islastconfirmedhistory  
    var t = table.new(position.top_right, 3, 2, color.green)  
    table.cell(t, 0, 0, "Original Matrix:")  
    table.cell(t, 0, 1, str.tostring(matrixOrig))  
    table.cell(t, 1, 0, "Removed Elements:")  
    table.cell(t, 1, 1, str.tostring(arr))  
    table.cell(t, 2, 0, "Result Matrix:")  
    table.cell(t, 2, 1, str.tostring(matrixCopy))
```

Returns

An array containing the elements of the row removed from the `id` matrix.

Remarks

Indexing of rows and columns starts at zero. It is far more efficient to declare matrices with explicit dimensions than to build them by adding or removing rows.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.set](#fun_matrix.set)[matrix.copy](#fun_matrix.copy)[matrix.remove\_col](#fun_matrix.remove_col)
