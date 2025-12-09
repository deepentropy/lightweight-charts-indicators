### table.cell\_set\_tooltip()

The function sets the tooltip in the specified cell.

Syntax

```
table.cell_set_tooltip(table_id, column, row, tooltip) → void
```

Arguments

table\_id (series table) A table object.

column (series int) The index of the cell's column. Numbering starts at 0.

row (series int) The index of the cell's row. Numbering starts at 0.

tooltip (series string) The tooltip to be displayed inside the cell.

Example

```
//@version=6  
indicator("TABLE example")  
var tLog = table.new(position = position.top_left, rows = 1, columns = 2, bgcolor = color.yellow, border_width=1)  
table.cell(tLog, row = 0, column = 0, text = "sometext", text_color = color.blue)  
table.cell_set_tooltip(tLog, row = 0, column = 0, tooltip = "sometext")
```

See also

[table.cell\_set\_bgcolor](#fun_table.cell_set_bgcolor)[table.cell\_set\_height](#fun_table.cell_set_height)[table.cell\_set\_text\_color](#fun_table.cell_set_text_color)[table.cell\_set\_text\_halign](#fun_table.cell_set_text_halign)[table.cell\_set\_text\_size](#fun_table.cell_set_text_size)[table.cell\_set\_text\_valign](#fun_table.cell_set_text_valign)[table.cell\_set\_width](#fun_table.cell_set_width)[table.cell\_set\_text](#fun_table.cell_set_text)
