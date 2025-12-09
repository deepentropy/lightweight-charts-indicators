### str.repeat()

4 overloads

Constructs a new string containing the `source` string repeated `repeat` times with the `separator` injected between each repeated instance.

Syntax & Overloads

[```
str.repeat(source, repeat, separator) → const string
```](#fun_str.repeat-0)[```
str.repeat(source, repeat, separator) → input string
```](#fun_str.repeat-1)[```
str.repeat(source, repeat, separator) → simple string
```](#fun_str.repeat-2)[```
str.repeat(source, repeat, separator) → series string
```](#fun_str.repeat-3)

Arguments

source (const string) String to repeat.

repeat (const int) Number of times to repeat the `source` string. Must be greater than or equal to 0.

separator (const string) String to inject between repeated values. Optional. The default is empty string.

Example

```
//@version=6  
indicator("str.repeat")  
repeat = str.repeat("?", 3, ",") // Returns "?,?,?"  
label.new(bar_index,close,repeat)
```

Remarks

Returns [na](#var_na) if the `source` is [na](#var_na).
