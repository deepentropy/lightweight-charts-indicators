### matrix.get()

The function returns the element with the specified index of the matrix.

Syntax

```
matrix.get(id, row, column) → <matrix_type>
```

Arguments

id (any matrix type) A matrix object.

row (series int) Index of the required row.

column (series int) Index of the required column.

Example

```
//@version=6  
indicator("`matrix.get()` Example", "", true)  
  
// Create a 2x3 "float" matrix from the `hl2` values.  
m = matrix.new<float>(2, 3, hl2)  
  
// Return the value of the element at index [0, 0] of matrix `m`.  
x = matrix.get(m, 0, 0)  
  
plot(x)
```

Returns

The value of the element at the `row` and `column` index of the `id` matrix.

Remarks

Indexing of the rows and columns starts at zero.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.set](#fun_matrix.set)[matrix.columns](#fun_matrix.columns)[matrix.rows](#fun_matrix.rows)
