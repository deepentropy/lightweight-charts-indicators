### matrix.median()

2 overloads

The function calculates the [median](https://en.wikipedia.org/wiki/Median) ("the middle" value) of matrix elements.

Syntax & Overloads

[```
matrix.median(id) → series float
```](#fun_matrix.median-0)[```
matrix.median(id) → series int
```](#fun_matrix.median-1)

Arguments

id (matrix<int/float>) A matrix object.

Example

```
//@version=6  
indicator("`matrix.median()` Example")  
  
// Create a 2x2 matrix.  
m = matrix.new<int>(2, 2, na)  
// Fill the matrix with values.  
matrix.set(m, 0, 0, 1)  
matrix.set(m, 0, 1, 2)  
matrix.set(m, 1, 0, 3)  
matrix.set(m, 1, 1, 4)  
  
// Get the median of the matrix.  
x = matrix.median(m)  
  
plot(x, 'Median of the matrix')
```

Remarks

Note that [na](#var_na) elements of the matrix are not considered when calculating the median.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.mode](#fun_matrix.mode)[matrix.sort](#fun_matrix.sort)[matrix.avg](#fun_matrix.avg)
