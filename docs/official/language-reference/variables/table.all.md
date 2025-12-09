### table.all

Returns an array filled with all the current tables drawn by the script.

Type

array<table>

Example

```
//@version=6  
indicator("table.all")  
//delete all tables  
table.new(position = position.top_right, columns = 2, rows = 1, bgcolor = color.yellow, border_width = 1)  
a_allTables = table.all  
if array.size(a_allTables) > 0  
    for i = 0 to array.size(a_allTables) - 1  
        table.delete(array.get(a_allTables, i))
```

Remarks

The array is read-only. Index zero of the array is the ID of the oldest object on the chart.

See also

[table.new](#fun_table.new)[line.all](#var_line.all)[label.all](#var_label.all)[box.all](#var_box.all)
