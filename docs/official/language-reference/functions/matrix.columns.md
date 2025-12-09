### matrix.columns()

The function returns the number of columns in the matrix.

Syntax

```
matrix.columns(id) → series int
```

Arguments

id (any matrix type) A matrix object.

Example

```
//@version=6  
indicator("`matrix.columns()` Example")  
  
// Create a 2x6 matrix with values `0`.  
var m = matrix.new<int>(2, 6, 0)  
  
// Get the quantity of columns in matrix `m`.  
var x = matrix.columns(m)  
  
// Display using a label.  
if barstate.islastconfirmedhistory  
    label.new(bar_index, high, "Columns: " + str.tostring(x) + "\n" + str.tostring(m))
```

Returns

The number of columns in the matrix `id`.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.get](#fun_matrix.get)[matrix.set](#fun_matrix.set)[matrix.col](#fun_matrix.col)[matrix.row](#fun_matrix.row)[matrix.rows](#fun_matrix.rows)
