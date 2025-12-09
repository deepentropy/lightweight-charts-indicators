### matrix.remove\_col()

The function removes the column at `column` index of the `id` matrix and returns an array containing the removed column's values.

Syntax

```
matrix.remove_col(id, column) → array<type>
```

Arguments

id (any matrix type) A matrix object.

column (series int) The index of the column to be removed. Optional. The default value is [matrix.columns](#fun_matrix.columns).

Example

```
//@version=6  
indicator("matrix_remove_col", overlay = true)  
  
// Create a 2x2 matrix with ones.  
var matrixOrig = matrix.new<int>(2, 2, 1)  
  
// Set values to the 'matrixOrig' matrix.  
matrix.set(matrixOrig, 0, 1, 2)  
matrix.set(matrixOrig, 1, 0, 3)  
matrix.set(matrixOrig, 1, 1, 4)  
  
  
// Create a copy of the 'matrixOrig' matrix.  
matrixCopy = matrix.copy(matrixOrig)  
  
// Remove the first column from the `matrixCopy` matrix.  
arr = matrix.remove_col(matrixCopy, 0)  
  
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

An array containing the elements of the column removed from the `id` matrix.

Remarks

Indexing of rows and columns starts at zero. It is far more efficient to declare matrices with explicit dimensions than to build them by adding or removing columns. Deleting a column is also much slower than deleting a row with the [matrix.remove\_row](#fun_matrix.remove_row) function.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.set](#fun_matrix.set)[matrix.copy](#fun_matrix.copy)[matrix.remove\_row](#fun_matrix.remove_row)
