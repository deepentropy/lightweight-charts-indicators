### str.format()

2 overloads

Creates a formatted string using a specified formatting string (`formatString`) and one or more additional arguments (`arg0`, `arg1`, etc.). The formatting string defines the structure of the returned string, where all placeholders in curly brackets (`{}`) refer to the additional arguments. Each placeholder requires a number representing an argument's position, starting from 0. For instance, the placeholder `{0}` refers to the first argument after `formatString` (`arg0`), `{1}` refers to the second (`arg1`), and so on. The function replaces each placeholder with a string representation of the corresponding argument.

Syntax & Overloads

[```
str.format(formatString, arg0, arg1, ...) → simple string
```](#fun_str.format-0)[```
str.format(formatString, arg0, arg1, ...) → series string
```](#fun_str.format-1)

Arguments

formatString (simple string) Format string.

arg0, arg1, ... (simple int/float/bool/string) Values to format.

Example

```
//@version=6  
indicator("Simple `str.format()` demo")  
  
//@variable A formatted string that includes representations of the current `bar_index` and `close` values.  
//          The placeholder `{0}` refers to the first argument after the formatting string (`bar_index`), and   
//          `{1}` refers to the second (`close`).  
string labelText = str.format("Current bar index: {0}\nCurrent bar close: {1}", bar_index, close)  
  
// Draw a label to display the `labelText` string at the current bar's `high` price.   
label.new(bar_index, high, labelText)
```

Example

```
//@version=6  
indicator("Extensive `str.format()` demo", overlay=true)  
// The format specifier inside the curly braces accepts certain modifiers:  
// - Specify the number of decimals to display:  
s1 = str.format("{0,number,#.#}", 1.34) // returns: 1.3  
label.new(bar_index, close, text=s1)  
// - Round a float value to an integer:  
s2 = str.format("{0,number,integer}", 1.34) // returns: 1  
label.new(bar_index - 1, close, text=s2)  
// - Display a number in currency:  
s3 = str.format("{0,number,currency}", 1.34) // returns: $1.34  
label.new(bar_index - 2, close, text=s3)  
// - Display a number as a percentage:  
s4 = str.format("{0,number,percent}", 0.5) // returns: 50%  
label.new(bar_index - 3, close, text=s4)  
// EXAMPLES WITH SEVERAL ARGUMENTS  
// returns: Number 1 is not equal to 4  
s5 = str.format("Number {0} is not {1} to {2}", 1, "equal", 4)  
label.new(bar_index - 4, close, text=s5)  
// returns: 1.34 != 1.3  
s6 = str.format("{0} != {0, number, #.#}", 1.34)  
label.new(bar_index - 5, close, text=s6)  
// returns: 1 is equal to 1, but 2 is equal to 2  
s7 = str.format("{0, number, integer} is equal to 1, but {1, number, integer} is equal to 2", 1.34, 1.52)  
label.new(bar_index - 6, close, text=s7)  
// returns: The cash turnover amounted to $1,340,000.00  
s8 = str.format("The cash turnover amounted to {0, number, currency}", 1340000)  
label.new(bar_index - 7, close, text=s8)  
// returns: Expected return is 10% - 20%  
s9 = str.format("Expected return is {0, number, percent} - {1, number, percent}", 0.1, 0.2)  
label.new(bar_index - 8, close, text=s9)
```

Returns

The formatted string.

Remarks

The string used as the `formatString` argument can contain single quote characters ('). However, programmers must pair all single quotes in that string to avoid unexpected formatting results.

All non-quoted left curly brackets must have corresponding right curly brackets in the formatting string. If the string contains imbalanced left curly brackets, it causes a runtime error. For example, "ab {0} de" and "ab }{0} de" are valid formatting strings, but "ab {0'}' de", "ab }{0}{ de" and "''{''{0}" are not.

The placeholders for "int" or "float" values or arrays can include modifiers and formatting tokens to customize how the resulting string represents them.

For example, the placeholder `{0,number,#.#)` specifies that the result inserts characters representing the `arg0` number rounded to one fractional digit.

For detailed information about placeholders and supported formats, refer to the [Formatting strings](https://www.tradingview.com/pine-script-docs/concepts/strings/#formatting-strings) section of our User Manual's [Strings](https://www.tradingview.com/pine-script-docs/concepts/strings/) page.

The apostrophe (`'`) acts as a quote character rather than a literal character inside formatting strings. If a formatting string has a sequence of characters between two apostrophes, the function's result includes those characters literally. For instance, the substring `'{'` adds a literal `{` character to the result instead of treating it as the start of a placeholder. Note that if a formatting string uses apostrophes instead of quotation marks for its enclosing characters, the string must escape any apostrophes within the character sequence using the backslash.
