### math.max()

8 overloads

Returns the greatest of multiple values.

Syntax & Overloads

[```
math.max(number0, number1, ...) → const int
```](#fun_math.max-0)[```
math.max(number0, number1, ...) → const float
```](#fun_math.max-1)[```
math.max(number0, number1, ...) → input int
```](#fun_math.max-2)[```
math.max(number0, number1, ...) → simple int
```](#fun_math.max-3)[```
math.max(number0, number1, ...) → input float
```](#fun_math.max-4)[```
math.max(number0, number1, ...) → series int
```](#fun_math.max-5)[```
math.max(number0, number1, ...) → simple float
```](#fun_math.max-6)[```
math.max(number0, number1, ...) → series float
```](#fun_math.max-7)

Arguments

number0, number1, ... (const int) A sequence of numbers to use in the calculation.

Example

```
//@version=6  
indicator("math.max", overlay=true)  
plot(math.max(close, open))  
plot(math.max(close, math.max(open, 42)))
```

Returns

The greatest of multiple given values.

See also

[math.min](#fun_math.min)
