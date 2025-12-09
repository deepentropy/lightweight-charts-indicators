### array.join()

The function creates and returns a new string by concatenating all the elements of an array, separated by the specified separator string.

Syntax

```
array.join(id, separator) → series string
```

Arguments

id (array<int/float/string>) An array object.

separator (series string) The string used to separate each array element.

Example

```
//@version=6  
indicator("array.join example")  
a = array.new_float(5, 5)  
label.new(bar_index, close, array.join(a, ","))
```

See also

[array.new\_float](#fun_array.new_float)[array.set](#fun_array.set)[array.insert](#fun_array.insert)[array.remove](#fun_array.remove)[array.pop](#fun_array.pop)[array.unshift](#fun_array.unshift)
