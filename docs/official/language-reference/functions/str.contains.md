### str.contains()

3 overloads

Returns true if the `source` string contains the `str` substring, false otherwise.

Syntax & Overloads

[```
str.contains(source, str) → const bool
```](#fun_str.contains-0)[```
str.contains(source, str) → simple bool
```](#fun_str.contains-1)[```
str.contains(source, str) → series bool
```](#fun_str.contains-2)

Arguments

source (const string) Source string.

str (const string) The substring to search for.

Example

```
//@version=6  
indicator("str.contains")  
// If the current chart is a continuous futures chart, e.g “BTC1!”, then the function will return true, false otherwise.  
var isFutures = str.contains(syminfo.tickerid, "!")  
plot(isFutures ? 1 : 0)
```

Returns

True if the `str` was found in the `source` string, false otherwise.

See also

[str.pos](#fun_str.pos)[str.match](#fun_str.match)
