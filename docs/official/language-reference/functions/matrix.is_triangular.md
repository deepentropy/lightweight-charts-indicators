### matrix.is\_triangular()

The function determines if the matrix is [triangular](https://en.wikipedia.org/wiki/Triangular_matrix) (if all elements above or below the [main diagonal](https://en.wikipedia.org/wiki/Main_diagonal) are zero).

Syntax

```
matrix.is_triangular(id) → series bool
```

Arguments

id (matrix<int/float>) Matrix object to test.

Returns

Returns true if the `id` matrix is triangular, false otherwise.

Remarks

Returns false with non-square matrices.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.set](#fun_matrix.set)[matrix.is\_square](#fun_matrix.is_square)
