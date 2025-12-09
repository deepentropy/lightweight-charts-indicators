### matrix.pow()

2 overloads

The function calculates the product of the matrix by itself `power` times.

Syntax & Overloads

[```
matrix.pow(id, power) → matrix<float>
```](#fun_matrix.pow-0)[```
matrix.pow(id, power) → matrix<int>
```](#fun_matrix.pow-1)

Arguments

id (matrix<int/float>) A matrix object.

power (series int) The number of times the matrix will be multiplied by itself.

Example

```
//@version=6  
indicator("`matrix.pow()` Example")  
  
// Display using a table.  
if barstate.islastconfirmedhistory  
    // Create a 2x2 matrix.  
    var m1 = matrix.new<int>(2, 2, 2)  
    // Calculate the power of three of the matrix.  
    var m2 = matrix.pow(m1, 3)  
  
    // Display matrix elements.  
    var t = table.new(position.top_right, 2, 2, color.green)  
    table.cell(t, 0, 0, "Original Matrix:")  
    table.cell(t, 0, 1, str.tostring(m1))  
    table.cell(t, 1, 0, "Matrix³:")  
    table.cell(t, 1, 1, str.tostring(m2))
```

Returns

The product of the `id` matrix by itself `power` times.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.set](#fun_matrix.set)[matrix.mult](#fun_matrix.mult)
