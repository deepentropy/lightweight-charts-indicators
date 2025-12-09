### array.sort()

The function sorts the elements of an array.

Syntax

```
array.sort(id, order) → void
```

Arguments

id (array<int/float/string>) An array object.

order (series sort\_order) The sort order: order.ascending (default) or order.descending.

Example

```
//@version=6  
indicator("array.sort example")  
a = array.new_float(0,0)  
for i = 0 to 5  
    array.push(a, high[i])  
array.sort(a, order.descending)  
if barstate.islast  
    label.new(bar_index, close, str.tostring(a))
```

See also

[array.new\_float](#fun_array.new_float)[array.insert](#fun_array.insert)[array.slice](#fun_array.slice)[array.reverse](#fun_array.reverse)[order.ascending](#const_order.ascending)[order.descending](#const_order.descending)
