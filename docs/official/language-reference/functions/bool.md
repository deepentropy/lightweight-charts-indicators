### bool()

4 overloads

Converts the `x` value to a [bool](#type_bool) value. Returns [false](#const_false) if `x` is [na](#var_na), [false](#const_false), or an [int](#type_int)/[float](#type_float) value equal to 0. Returns [true](#const_true) for all other possible values.

Syntax & Overloads

[```
bool(x) → const bool
```](#fun_bool-0)[```
bool(x) → input bool
```](#fun_bool-1)[```
bool(x) → simple bool
```](#fun_bool-2)[```
bool(x) → series bool
```](#fun_bool-3)

Arguments

x (simple int/float/bool) The value to convert to the specified type, usually [na](#var_na).

Returns

The value of the argument after casting to bool.

See also

[float](#fun_float)[int](#fun_int)[color](#fun_color)[string](#fun_string)[line](#fun_line)[label](#fun_label)
