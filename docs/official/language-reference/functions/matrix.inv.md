### matrix.inv()

2 overloads

The function returns the [inverse](https://en.wikipedia.org/wiki/Invertible_matrix) of a square matrix.

Syntax & Overloads

[```
matrix.inv(id) → matrix<float>
```](#fun_matrix.inv-0)[```
matrix.inv(id) → matrix<int>
```](#fun_matrix.inv-1)

Arguments

id (matrix<int/float>) A matrix object.

Example

```
//@version=6  
indicator("`matrix.inv()` Example")  
  
// For efficiency, execute this code only once.  
if barstate.islastconfirmedhistory  
    // Create a 2x2 matrix.  
    var m1 = matrix.new<int>(2, 2, na)  
    // Fill the matrix with values.  
    matrix.set(m1, 0, 0, 1)  
    matrix.set(m1, 0, 1, 2)  
    matrix.set(m1, 1, 0, 3)  
    matrix.set(m1, 1, 1, 4)  
  
    // Inverse of the matrix.  
    var m2 = matrix.inv(m1)  
  
    // Display matrix elements.  
    var t = table.new(position.top_right, 2, 2, color.green)  
    table.cell(t, 0, 0, "Original Matrix:")  
    table.cell(t, 0, 1, str.tostring(m1))  
    table.cell(t, 1, 0, "Inverse matrix:")  
    table.cell(t, 1, 1, str.tostring(m2))
```

Returns

A new matrix, which is the inverse of the `id` matrix.

Remarks

The function is calculated using the [LU decomposition](https://en.wikipedia.org/wiki/LU_decomposition) algorithm.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.set](#fun_matrix.set)[matrix.pinv](#fun_matrix.pinv)[matrix.copy](#fun_matrix.copy)[str.tostring](#fun_str.tostring)
