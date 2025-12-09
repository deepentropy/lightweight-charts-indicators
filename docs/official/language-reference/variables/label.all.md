### label.all

Returns an array filled with all the current labels drawn by the script.

Type

array<label>

Example

```
//@version=6  
indicator("label.all")  
//delete all labels  
label.new(bar_index, close)  
a_allLabels = label.all  
if array.size(a_allLabels) > 0  
    for i = 0 to array.size(a_allLabels) - 1  
        label.delete(array.get(a_allLabels, i))
```

Remarks

The array is read-only. Index zero of the array is the ID of the oldest object on the chart.

See also

[label.new](#fun_label.new)[line.all](#var_line.all)[box.all](#var_box.all)[table.all](#var_table.all)
