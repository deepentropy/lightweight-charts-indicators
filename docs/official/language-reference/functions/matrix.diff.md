### matrix.diff()

2 overloads

The function returns a new matrix resulting from the subtraction between matrices `id1` and `id2`, or of matrix `id1` and an `id2` scalar (a numerical value).

Syntax & Overloads

[```
matrix.diff(id1, id2) → matrix<int>
```](#fun_matrix.diff-0)[```
matrix.diff(id1, id2) → matrix<float>
```](#fun_matrix.diff-1)

Arguments

id1 (matrix<int>) Matrix to subtract from.

id2 (series int/float/matrix<int>) Matrix object or a scalar value to be subtracted.

Difference between two matrices

Example

```
//@version=6  
indicator("`matrix.diff()` Example 1")  
  
// For efficiency, execute this code only once.  
if barstate.islastconfirmedhistory  
    // Create a 2x3 matrix containing values `5`.  
    var m1 = matrix.new<float>(2, 3, 5)  
    // Create a 2x3 matrix containing values `4`.  
    var m2 = matrix.new<float>(2, 3, 4)  
    // Create a new matrix containing the difference between matrices `m1` and `m2`.  
    var m3 = matrix.diff(m1, m2)  
  
    // Display using a table.  
    var t = table.new(position.top_right, 1, 2, color.green)  
    table.cell(t, 0, 0, "Difference between two matrices:")  
    table.cell(t, 0, 1, str.tostring(m3))
```

Difference between a matrix and a scalar value

Example

```
//@version=6  
indicator("`matrix.diff()` Example 2")  
  
// For efficiency, execute this code only once.  
if barstate.islastconfirmedhistory  
    // Create a 2x3 matrix with values `4`.  
    var m1 = matrix.new<float>(2, 3, 4)  
  
    // Create a new matrix containing the difference between the `m1` matrix and the "int" value `1`.  
    var m2 = matrix.diff(m1, 1)  
  
    // Display using a table.  
    var t = table.new(position.top_right, 1, 2, color.green)  
    table.cell(t, 0, 0, "Difference between a matrix and a scalar:")  
    table.cell(t, 0, 1, str.tostring(m2))
```

Returns

A new matrix object containing the difference between `id2` and `id1`.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.get](#fun_matrix.get)[matrix.set](#fun_matrix.set)[matrix.columns](#fun_matrix.columns)[matrix.rows](#fun_matrix.rows)
