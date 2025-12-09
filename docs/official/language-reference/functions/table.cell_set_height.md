### table.cell\_set\_height()

The function sets the height of cell.

Syntax

```
table.cell_set_height(table_id, column, row, height) → void
```

Arguments

table\_id (series table) A table object.

column (series int) The index of the cell's column. Numbering starts at 0.

row (series int) The index of the cell's row. Numbering starts at 0.

height (series int/float) The height of the cell as a % of the chart window. Passing 0 auto-adjusts the height based on the text inside of the cell.

See also

[table.cell\_set\_bgcolor](#fun_table.cell_set_bgcolor)[table.cell\_set\_text](#fun_table.cell_set_text)[table.cell\_set\_text\_color](#fun_table.cell_set_text_color)[table.cell\_set\_text\_halign](#fun_table.cell_set_text_halign)[table.cell\_set\_text\_size](#fun_table.cell_set_text_size)[table.cell\_set\_text\_valign](#fun_table.cell_set_text_valign)[table.cell\_set\_width](#fun_table.cell_set_width)[table.cell\_set\_tooltip](#fun_table.cell_set_tooltip)
