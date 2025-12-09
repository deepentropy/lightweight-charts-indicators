### math.pow()

4 overloads

Mathematical power function.

Syntax & Overloads

[```
math.pow(base, exponent) → const float
```](#fun_math.pow-0)[```
math.pow(base, exponent) → input float
```](#fun_math.pow-1)[```
math.pow(base, exponent) → simple float
```](#fun_math.pow-2)[```
math.pow(base, exponent) → series float
```](#fun_math.pow-3)

Arguments

base (const int/float) Specify the base to use.

exponent (const int/float) Specifies the exponent.

Example

```
//@version=6  
indicator("math.pow", overlay=true)  
plot(math.pow(close, 2))
```

Returns

`base` raised to the power of `exponent`. If `base` is a series, it is calculated elementwise.

See also

[math.sqrt](#fun_math.sqrt)[math.exp](#fun_math.exp)
