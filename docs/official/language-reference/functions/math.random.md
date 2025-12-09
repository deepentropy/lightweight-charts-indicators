### math.random()

Returns a pseudo-random value. The function will generate a different sequence of values for each script execution. Using the same value for the optional seed argument will produce a repeatable sequence.

Syntax

```
math.random(min, max, seed) → series float
```

Arguments

min (series int/float) The lower bound of the range of random values. The value is not included in the range. The default is 0.

max (series int/float) The upper bound of the range of random values. The value is not included in the range. The default is 1.

seed (series int) Optional argument. When the same seed is used, allows successive calls to the function to produce a repeatable set of values.

Returns

A random value.
