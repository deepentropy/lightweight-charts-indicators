### matrix.concat()

The function appends the `m2` matrix to the `m1` matrix.

Syntax

```
matrix.concat(id1, id2) → matrix<type>
```

Arguments

id1 (any matrix type) Matrix object to concatenate into.

id2 (any matrix type) Matrix object whose elements will be appended to `id1`.

Example

```
//@version=6  
indicator("`matrix.concat()` Example")  
  
// Create a 2x4 "int" matrix containing values `0`.  
m1 = matrix.new<int>(2, 4, 0)  
// Create a 2x4 "int" matrix containing values `1`.  
m2 = matrix.new<int>(2, 4, 1)  
  
// Append matrix `m2` to `m1`.  
matrix.concat(m1, m2)  
  
// Display matrix elements.  
if barstate.islastconfirmedhistory  
    var t = table.new(position.top_right, 2, 2, color.green)  
    table.cell(t, 0, 0, "Matrix Elements:")  
    table.cell(t, 0, 1, str.tostring(m1))
```

Returns

Returns the `id1` matrix concatenated with the `id2` matrix.

Remarks

The number of columns in both matrices must be identical.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.get](#fun_matrix.get)[matrix.set](#fun_matrix.set)[matrix.columns](#fun_matrix.columns)[matrix.rows](#fun_matrix.rows)
