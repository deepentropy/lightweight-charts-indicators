### matrix.reverse()

The function reverses the order of rows and columns in the matrix `id`. The first row and first column become the last, and the last become the first.

Syntax

```
matrix.reverse(id) → void
```

Arguments

id (any matrix type) A matrix object.

Example

```
//@version=6  
indicator("`matrix.reverse()` Example")  
  
// For efficiency, execute this code only once.  
if barstate.islastconfirmedhistory  
    // Copy the matrix to a new one.  
    var m1 = matrix.new<int>(2, 2, na)  
    // Fill the matrix with values.  
    matrix.set(m1, 0, 0, 1)  
    matrix.set(m1, 0, 1, 2)  
    matrix.set(m1, 1, 0, 3)  
    matrix.set(m1, 1, 1, 4)  
  
    // Copy matrix elements to a new matrix.  
    var m2 = matrix.copy(m1)  
  
    // Reverse the `m2` copy of the original matrix.  
    matrix.reverse(m2)  
  
    // Display using a table.  
    var t = table.new(position.top_right, 2, 2, color.green)  
    table.cell(t, 0, 0, "Original matrix:")  
    table.cell(t, 0, 1, str.tostring(m1))  
    table.cell(t, 1, 0, "Reversed matrix:")  
    table.cell(t, 1, 1, str.tostring(m2))
```

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.set](#fun_matrix.set)[matrix.columns](#fun_matrix.columns)[matrix.rows](#fun_matrix.rows)[matrix.reshape](#fun_matrix.reshape)
