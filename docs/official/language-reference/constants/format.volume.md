### format.volume

Is a named constant for selecting the formatting of the script output values as volume in the [indicator](#fun_indicator) function, e.g. '5183' will be formatted as '5.183K'.

The decimal precision rules defined by this variable take precedence over other precision settings. When an [indicator](#fun_indicator), [strategy](#fun_strategy), or `plot*()` call uses this `format` option, the function's `precision` parameter will not affect the result.

Type

const string

See also

[indicator](#fun_indicator)[format.inherit](#const_format.inherit)[format.price](#const_format.price)[format.percent](#const_format.percent)
