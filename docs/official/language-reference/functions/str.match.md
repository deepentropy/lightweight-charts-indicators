### str.match()

2 overloads

Returns the new substring of the `source` string if it matches a `regex` regular expression, an empty string otherwise.

Syntax & Overloads

[```
str.match(source, regex) → simple string
```](#fun_str.match-0)[```
str.match(source, regex) → series string
```](#fun_str.match-1)

Arguments

source (simple string) Source string.

regex (simple string) The regular expression to which this string is to be matched.

Example

```
//@version=6  
indicator("str.match")  
  
s = input.string("It's time to sell some NASDAQ:AAPL!")  
  
// finding first substring that matches regular expression "[\w]+:[\w]+"  
var string tickerid = str.match(s, "[\\w]+:[\\w]+")  
  
if barstate.islastconfirmedhistory  
    label.new(bar_index, high, text = tickerid) // "NASDAQ:AAPL"
```

Returns

The new substring of the `source` string if it matches a `regex` regular expression, an empty string otherwise.

Remarks

Function returns first occurrence of the [regular expression](https://en.wikipedia.org/wiki/Regular_expression#Perl_and_PCRE) in the `source` string.

The backslash "\" symbol in the`regex` string needs to be escaped with additional backslash, e.g. "\\d" stands for regular expression "\d".

See also

[str.contains](#fun_str.contains)[str.substring](#fun_str.substring)
