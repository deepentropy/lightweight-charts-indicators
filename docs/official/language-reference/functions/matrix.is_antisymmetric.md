### matrix.is\_antisymmetric()

The function determines if a matrix is [antisymmetric](https://en.wikipedia.org/wiki/Skew-symmetric_matrix) (its [transpose](https://en.wikipedia.org/wiki/Transpose) equals its negative).

Syntax

```
matrix.is_antisymmetric(id) → series bool
```

Arguments

id (matrix<int/float>) Matrix object to test.

Returns

Returns true, if the `id` matrix is antisymmetric, false otherwise.

Remarks

Returns false with non-square matrices.

See also

[matrix.new<type>](#fun_matrix.new<type>)[matrix.get](#fun_matrix.get)[matrix.set](#fun_matrix.set)[matrix.is\_square](#fun_matrix.is_square)
