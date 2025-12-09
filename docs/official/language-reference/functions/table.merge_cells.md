### table.merge\_cells()

The function merges a sequence of cells in the table into one cell. The cells are merged in a rectangle shape where the start\_column and start\_row specify the top-left corner, and end\_column and end\_row specify the bottom-right corner.

Syntax

```
table.merge_cells(table_id, start_column, start_row, end_column, end_row) → void
```

Arguments

table\_id (series table) A table object.

start\_column (series int) The index of the column of the first cell to merge. Numbering starts at 0.

start\_row (series int) The index of the row of the first cell to merge. Numbering starts at 0.

end\_column (series int) The index of the column of the last cell to merge. Numbering starts at 0.

end\_row (series int) The index of the row of the last cell to merge. Numbering starts at 0.

Example

```
//@version=6  
indicator("table.merge_cells example")  
SMA50  = ta.sma(close, 50)  
SMA100 = ta.sma(close, 100)  
SMA200 = ta.sma(close, 200)  
if barstate.islast  
    maTable = table.new(position.bottom_right, 3, 3, bgcolor = color.gray, border_width = 1, border_color = color.black)  
    // Header  
    table.cell(maTable, 0, 0, text = "SMA Table")  
    table.merge_cells(maTable, 0, 0, 2, 0)  
    // Cell Titles  
    table.cell(maTable, 0, 1, text = "SMA 50")  
    table.cell(maTable, 1, 1, text = "SMA 100")  
    table.cell(maTable, 2, 1, text = "SMA 200")  
    // Values  
    table.cell(maTable, 0, 2, bgcolor = color.white, text = str.tostring(SMA50))  
    table.cell(maTable, 1, 2, bgcolor = color.white, text = str.tostring(SMA100))  
    table.cell(maTable, 2, 2, bgcolor = color.white, text = str.tostring(SMA200))
```

Remarks

This function will merge cells, even if their properties are not yet defined with [table.cell](#fun_table.cell).

The resulting merged cell inherits all of its values from the cell located at `start_column`:`start_row`, except width and height. The width and height of the resulting merged cell are based on the width/height of other cells in the neighboring columns/rows and cannot be set manually.

To modify the merged cell with any of the `table.cell_set_*` functions, target the cell at the `start_column`:`start_row` coordinates.

An attempt to merge a cell that has already been merged will result in an error.

See also

[table.delete](#fun_table.delete)[table.new](#fun_table.new)
