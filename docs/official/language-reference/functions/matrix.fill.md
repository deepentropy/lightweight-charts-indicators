### matrix.fill()

The function fills a rectangular area of the `id` matrix defined by the indices `from_column` to `to_column` (not including it) and `from_row` to `to_row`(not including it) with the `value`.

Syntax

```
matrix.fill(id, value, from_row, to_row, from_column, to_column) → void
```

Arguments

id (any matrix type) A matrix object.

value (series <type of the matrix's elements>) The value to fill with.

from\_row (series int) Row index from which the fill will begin (inclusive). Optional. The default value is 0.

to\_row (series int) Row index where the fill will end (not inclusive). Optional. The default value is [matrix.rows](#fun_matrix.rows).

from\_column (series int) Column index from which the fill will begin (inclusive). Optional. The default value is 0.

to\_column (series int) Column index where the fill will end (non inclusive). Optional. The default value is [matrix.columns](#fun_matrix.columns).

Example

```
//@version=6  
indicator("`matrix.fill()` Example")  
  
// Create a 4x5 "int" matrix containing values `0`.  
m = matrix.new<float>(4, 5, 0)  
  
// Fill the intersection of rows 1 to 2 and columns 2 to 3 of the matrix with `hl2` values.  
matrix.fill(m, hl2, 0, 2, 1, 3)  
  
// Display using a label.  
if barstate.islastconfirmedhistory  
    label.new(bar_index, high, str.tostring(m))
```

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.get](#fun_matrix.get)[matrix.set](#fun_matrix.set)[matrix.columns](#fun_matrix.columns)[matrix.rows](#fun_matrix.rows)
