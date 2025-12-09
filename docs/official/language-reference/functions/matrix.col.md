### matrix.col()

The function creates a one-dimensional array from the elements of a matrix column.

Syntax

```
matrix.col(id, column) → array<type>
```

Arguments

id (any matrix type) A matrix object.

column (series int) Index of the required column.

Example

```
//@version=6  
indicator("`matrix.col()` Example", "", true)  
  
// Create a 2x3 "float" matrix from `hlc3` values.  
m = matrix.new<float>(2, 3, hlc3)  
  
// Return an array with the values of the first column of matrix `m`.  
a = matrix.col(m, 0)  
  
// Plot the first value from the array `a`.  
plot(array.get(a, 0))
```

Returns

An array ID containing the `column` values of the `id` matrix.

Remarks

Indexing of rows starts at 0.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.get](#fun_matrix.get)[array.get](#fun_array.get)[matrix.col](#fun_matrix.col)[matrix.columns](#fun_matrix.columns)
