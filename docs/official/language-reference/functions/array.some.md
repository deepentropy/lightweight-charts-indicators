### array.some()

Returns [true](#const_true) if at least one element of the `id` array is [true](#const_true), [false](#const_false) otherwise.

Syntax

```
array.some(id) → series bool
```

Arguments

id (array<bool>) An array object.

Remarks

This function also works with arrays of [int](#type_int) and [float](#type_float) types, in which case zero values are considered [false](#const_false), and all others [true](#const_true).

See also

[array.every](#fun_array.every)[array.get](#fun_array.get)
