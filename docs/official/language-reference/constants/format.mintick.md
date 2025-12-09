### format.mintick

Is a named constant to use with the [str.tostring](#fun_str.tostring) function. Passing a number to [str.tostring](#fun_str.tostring) with this argument rounds the number to the nearest value that can be divided by [syminfo.mintick](#var_syminfo.mintick), without the remainder, with ties rounding up, and returns the string version of said value with trailing zeros.

Type

const string

See also

[indicator](#fun_indicator)[format.inherit](#const_format.inherit)[format.price](#const_format.price)[format.volume](#const_format.volume)
