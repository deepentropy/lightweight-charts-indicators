### str.pos()

3 overloads

Returns the position of the first occurrence of the `str` string in the `source` string, 'na' otherwise.

Syntax & Overloads

[```
str.pos(source, str) → const int
```](#fun_str.pos-0)[```
str.pos(source, str) → simple int
```](#fun_str.pos-1)[```
str.pos(source, str) → series int
```](#fun_str.pos-2)

Arguments

source (const string) Source string.

str (const string) The substring to search for.

Returns

Position of the `str` string in the `source` string.

Remarks

Strings indexing starts at 0.

See also

[str.contains](#fun_str.contains)[str.match](#fun_str.match)[str.substring](#fun_str.substring)
