### matrix.trace()

2 overloads

The function calculates the [trace](https://en.wikipedia.org/wiki/Trace_(linear_algebra)) of a matrix (the sum of the main diagonal's elements).

Syntax & Overloads

[```
matrix.trace(id) → series float
```](#fun_matrix.trace-0)[```
matrix.trace(id) → series int
```](#fun_matrix.trace-1)

Arguments

id (matrix<int/float>) A matrix object.

Example

```
//@version=6  
indicator("`matrix.trace()` Example")  
  
// For efficiency, execute this code only once.  
if barstate.islastconfirmedhistory  
    // Create a 2x2 matrix.  
    var m1 = matrix.new<int>(2, 2, na)  
    // Fill the matrix with values.  
    matrix.set(m1, 0, 0, 1)  
    matrix.set(m1, 0, 1, 2)  
    matrix.set(m1, 1, 0, 3)  
    matrix.set(m1, 1, 1, 4)  
  
    // Get the trace of the matrix.  
    tr = matrix.trace(m1)  
  
    // Display matrix elements.  
    var t = table.new(position.top_right, 2, 2, color.green)  
    table.cell(t, 0, 0, "Matrix elements:")  
    table.cell(t, 0, 1, str.tostring(m1))  
    table.cell(t, 1, 0, "Trace of the matrix:")  
    table.cell(t, 1, 1, str.tostring(tr))
```

Returns

The trace of the `id` matrix.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.get](#fun_matrix.get)[matrix.set](#fun_matrix.set)[matrix.columns](#fun_matrix.columns)[matrix.rows](#fun_matrix.rows)
