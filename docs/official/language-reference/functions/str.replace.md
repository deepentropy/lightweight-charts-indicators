### str.replace()

3 overloads

Returns a new string with the Nth occurrence of the `target` string replaced by the `replacement` string, where N is specified in `occurrence`.

Syntax & Overloads

[```
str.replace(source, target, replacement, occurrence) → const string
```](#fun_str.replace-0)[```
str.replace(source, target, replacement, occurrence) → simple string
```](#fun_str.replace-1)[```
str.replace(source, target, replacement, occurrence) → series string
```](#fun_str.replace-2)

Arguments

source (const string) Source string.

target (const string) String to be replaced.

replacement (const string) String to be inserted instead of the target string.

occurrence (const int) N-th occurrence of the target string to replace. Indexing starts at 0 for the first match. Optional. Default value is 0.

Example

```
//@version=6  
indicator("str.replace")  
var source = "FTX:BTCUSD / FTX:BTCEUR"  
  
// Replace first occurrence of "FTX" with "BINANCE" replacement string  
var newSource = str.replace(source, "FTX", "BINANCE", 0)  
  
if barstate.islastconfirmedhistory  
    // Display "BINANCE:BTCUSD / FTX:BTCEUR"  
    label.new(bar_index, high, text = newSource)
```

Returns

Processed string.

See also

[str.replace\_all](#fun_str.replace_all)[str.match](#fun_str.match)
