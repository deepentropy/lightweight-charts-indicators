### matrix.is\_symmetric()

The function determines if a [square matrix](https://en.wikipedia.org/wiki/Square_matrix) is [symmetric](https://en.wikipedia.org/wiki/Symmetric_matrix) (elements are symmetric with respect to the [main diagonal](https://en.wikipedia.org/wiki/Main_diagonal)).

Syntax

```
matrix.is_symmetric(id) → series bool
```

Arguments

id (matrix<int/float>) Matrix object to test.

Returns

Returns true if the `id` matrix is symmetric, false otherwise.

Remarks

Returns false with non-square matrices.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.get](#fun_matrix.get)[matrix.set](#fun_matrix.set)[matrix.is\_square](#fun_matrix.is_square)
