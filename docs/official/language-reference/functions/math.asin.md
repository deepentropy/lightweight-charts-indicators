### math.asin()

4 overloads

The asin function returns the arcsine (in radians) of number such that sin(asin(y)) = y for y in range [-1, 1].

Syntax & Overloads

[```
math.asin(angle) → const float
```](#fun_math.asin-0)[```
math.asin(angle) → input float
```](#fun_math.asin-1)[```
math.asin(angle) → simple float
```](#fun_math.asin-2)[```
math.asin(angle) → series float
```](#fun_math.asin-3)

Arguments

angle (const int/float) The value, in radians, to use in the calculation.

Returns

The arcsine of a value; the returned angle is in the range [-Pi/2, Pi/2], or [na](#var_na) if y is outside of range [-1, 1].
