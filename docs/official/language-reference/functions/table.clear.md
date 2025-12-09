### table.clear()

The function removes a cell or a sequence of cells from the table. The cells are removed in a rectangle shape where the start\_column and start\_row specify the top-left corner, and end\_column and end\_row specify the bottom-right corner.

Syntax

```
table.clear(table_id, start_column, start_row, end_column, end_row) → void
```

Arguments

table\_id (series table) A table object.

start\_column (series int) The index of the column of the first cell to delete. Numbering starts at 0.

start\_row (series int) The index of the row of the first cell to delete. Numbering starts at 0.

end\_column (series int) The index of the column of the last cell to delete. Optional. The default is the argument used for start\_column. Numbering starts at 0.

end\_row (series int) The index of the row of the last cell to delete. Optional. The default is the argument used for start\_row. Numbering starts at 0.

Example

```
//@version=6  
indicator("A donut", overlay=true)  
if barstate.islast  
    colNum = 8, rowNum = 8  
    padding = "◯"  
    donutTable = table.new(position.middle_right, colNum, rowNum)  
    for c = 0 to colNum - 1  
        for r = 0 to rowNum - 1  
            table.cell(donutTable, c, r, text=padding, bgcolor=#face6e, text_color=color.new(color.black, 100))  
    table.clear(donutTable, 2, 2, 5, 5)
```

See also

[table.delete](#fun_table.delete)[table.new](#fun_table.new)
