### matrix.kron()

2 overloads

The function returns the [Kronecker product](https://en.wikipedia.org/wiki/Kronecker_product) for the `id1` and `id2` matrices.

Syntax & Overloads

[```
matrix.kron(id1, id2) → matrix<float>
```](#fun_matrix.kron-0)[```
matrix.kron(id1, id2) → matrix<int>
```](#fun_matrix.kron-1)

Arguments

id1 (matrix<int/float>) First matrix object.

id2 (matrix<int/float>) Second matrix object.

Example

```
//@version=6  
indicator("`matrix.kron()` Example")  
  
// Display using a table.  
if barstate.islastconfirmedhistory  
    // Create two matrices with default values `1` and `2`.  
    var m1 = matrix.new<float>(2, 2, 1)  
    var m2 = matrix.new<float>(2, 2, 2)  
  
    // Calculate the Kronecker product of the matrices.  
    var m3 = matrix.kron(m1, m2)  
  
    // Display matrix elements.  
    var t = table.new(position.top_right, 5, 2, color.green)  
    table.cell(t, 0, 0, "Matrix 1:")  
    table.cell(t, 0, 1, str.tostring(m1))  
    table.cell(t, 1, 1, "⊗")  
    table.cell(t, 2, 0, "Matrix 2:")  
    table.cell(t, 2, 1, str.tostring(m2))  
    table.cell(t, 3, 1, "=")  
    table.cell(t, 4, 0, "Kronecker product:")  
    table.cell(t, 4, 1, str.tostring(m3))
```

Returns

A new matrix containing the [Kronecker product](https://en.wikipedia.org/wiki/Kronecker_product) of `id1` and `id2`.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.mult](#fun_matrix.mult)[str.tostring](#fun_str.tostring)[table.new](#fun_table.new)
