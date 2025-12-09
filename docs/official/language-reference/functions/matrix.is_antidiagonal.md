### matrix.is\_antidiagonal()

The function determines if the matrix is [anti-diagonal](https://en.wikipedia.org/wiki/Anti-diagonal_matrix) (all elements outside the secondary diagonal are zero).

Syntax

```
matrix.is_antidiagonal(id) → series bool
```

Arguments

id (matrix<int/float>) Matrix object to test.

Returns

Returns true if the `id` matrix is ​​anti-diagonal, false otherwise.

Remarks

Returns false with non-square matrices.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.set](#fun_matrix.set)[matrix.is\_square](#fun_matrix.is_square)[matrix.is\_identity](#fun_matrix.is_identity)[matrix.is\_diagonal](#fun_matrix.is_diagonal)
