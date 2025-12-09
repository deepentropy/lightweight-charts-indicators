### matrix.max()

2 overloads

The function returns the largest value from the matrix elements.

Syntax & Overloads

[```
matrix.max(id) → series float
```](#fun_matrix.max-0)[```
matrix.max(id) → series int
```](#fun_matrix.max-1)

Arguments

id (matrix<int/float>) A matrix object.

Example

```
//@version=6  
indicator("`matrix.max()` Example")  
  
// Create a 2x2 matrix.  
var m = matrix.new<int>(2, 2, na)  
// Fill the matrix with values.  
matrix.set(m, 0, 0, 1)  
matrix.set(m, 0, 1, 2)  
matrix.set(m, 1, 0, 3)  
matrix.set(m, 1, 1, 4)  
  
// Get the maximum value in the matrix.  
var x = matrix.max(m)  
  
plot(x, 'Matrix maximum value')
```

Returns

The maximum value from the `id` matrix.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.min](#fun_matrix.min)[matrix.avg](#fun_matrix.avg)[matrix.sort](#fun_matrix.sort)
