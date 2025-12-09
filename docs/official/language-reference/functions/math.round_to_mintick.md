### math.round\_to\_mintick()

2 overloads

Returns the value rounded to the symbol's mintick, i.e. the nearest value that can be divided by [syminfo.mintick](#var_syminfo.mintick), without the remainder, with ties rounding up.

Syntax & Overloads

[```
math.round_to_mintick(number) → simple float
```](#fun_math.round_to_mintick-0)[```
math.round_to_mintick(number) → series float
```](#fun_math.round_to_mintick-1)

Arguments

number (simple int/float) The value to be rounded.

Returns

The `number` rounded to tick precision.

Remarks

Note that for 'na' values function returns 'na'.

See also

[math.ceil](#fun_math.ceil)[math.floor](#fun_math.floor)
