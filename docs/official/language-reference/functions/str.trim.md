### str.trim()

4 overloads

Constructs a new string with all consecutive whitespaces and other control characters (e.g., “\n”, “\t”, etc.) removed from the left and right of the `source`.

Syntax & Overloads

[```
str.trim(source) → const string
```](#fun_str.trim-0)[```
str.trim(source) → input string
```](#fun_str.trim-1)[```
str.trim(source) → simple string
```](#fun_str.trim-2)[```
str.trim(source) → series string
```](#fun_str.trim-3)

Arguments

source (const string) String to trim.

Example

```
//@version=6  
indicator("str.trim")  
trim = str.trim("    abc    ") // Returns "abc"  
label.new(bar_index,close,trim)
```

Remarks

Returns an empty string ("") if the result is empty after the trim or if the `source` is [na](#var_na).
