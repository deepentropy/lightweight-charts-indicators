### line.all

Returns an array filled with all the current lines drawn by the script.

Type

array<line>

Example

```
//@version=6  
indicator("line.all")  
//delete all lines  
line.new(bar_index - 10, close, bar_index, close)  
a_allLines = line.all  
if array.size(a_allLines) > 0  
    for i = 0 to array.size(a_allLines) - 1  
        line.delete(array.get(a_allLines, i))
```

Remarks

The array is read-only. Index zero of the array is the ID of the oldest object on the chart.

See also

[line.new](#fun_line.new)[label.all](#var_label.all)[box.all](#var_box.all)[table.all](#var_table.all)
