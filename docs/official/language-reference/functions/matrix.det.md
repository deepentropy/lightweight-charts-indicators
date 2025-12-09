### matrix.det()

2 overloads

The function returns the [determinant](https://en.wikipedia.org/wiki/Determinant) of a square matrix.

Syntax & Overloads

[```
matrix.det(id) → series float
```](#fun_matrix.det-0)[```
matrix.det(id) → series int
```](#fun_matrix.det-1)

Arguments

id (matrix<int/float>) A matrix object.

Example

```
//@version=6  
indicator("`matrix.det` Example")  
  
// Create a 2x2 matrix.  
var m = matrix.new<float>(2, 2, na)  
// Fill the matrix with values.  
matrix.set(m, 0, 0,  3)  
matrix.set(m, 0, 1,  7)  
matrix.set(m, 1, 0,  1)  
matrix.set(m, 1, 1, -4)  
  
// Get the determinant of the matrix.  
var x = matrix.det(m)  
  
plot(x, 'Matrix determinant')
```

Returns

The determinant value of the `id` matrix.

Remarks

Function calculation based on the [LU decomposition](https://en.wikipedia.org/wiki/LU_decomposition) algorithm.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.set](#fun_matrix.set)[matrix.is\_square](#fun_matrix.is_square)
