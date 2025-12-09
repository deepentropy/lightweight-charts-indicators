### str.substring()

3 overloads

Returns a new string that is a substring of the `source` string. The substring begins with the character at the index specified by `begin_pos` and extends to 'end\_pos - 1' of the `source` string.

Syntax & Overloads

[```
str.substring(source, begin_pos, end_pos) → const string
```](#fun_str.substring-0)[```
str.substring(source, begin_pos, end_pos) → simple string
```](#fun_str.substring-1)[```
str.substring(source, begin_pos, end_pos) → series string
```](#fun_str.substring-2)

Arguments

source (const string) Source string from which to extract the substring.

begin\_pos (const int) The beginning position of the extracted substring. It is inclusive (the extracted substring includes the character at that position).

end\_pos (const int) The ending position. It is exclusive (the extracted string does NOT include that position's character). Optional. The default is the length of the `source` string.

Example

```
//@version=6  
indicator("str.substring", overlay = true)  
sym= input.symbol("NASDAQ:AAPL")  
pos = str.pos(sym, ":") // Get position of ":" character  
tkr= str.substring(sym, pos+1) // "AAPL"  
if barstate.islastconfirmedhistory  
    label.new(bar_index, high, text = tkr)
```

Returns

The substring extracted from the source string.

Remarks

Strings indexing starts from 0. If `begin_pos` is equal to `end_pos`, the function returns an empty string.

See also

[str.contains](#fun_str.contains)[str.pos](#fun_str.pos)[str.match](#fun_str.match)
