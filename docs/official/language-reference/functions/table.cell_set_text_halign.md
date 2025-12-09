### table.cell\_set\_text\_halign()

The function sets the horizontal alignment of the cell's text.

Syntax

```
table.cell_set_text_halign(table_id, column, row, text_halign) → void
```

Arguments

table\_id (series table) A table object.

column (series int) The index of the cell's column. Numbering starts at 0.

row (series int) The index of the cell's row. Numbering starts at 0.

text\_halign (series string) The horizontal alignment of a cell's text. Possible values: [text.align\_left](#const_text.align_left), [text.align\_center](#const_text.align_center), [text.align\_right](#const_text.align_right).

See also

[table.cell\_set\_bgcolor](#fun_table.cell_set_bgcolor)[table.cell\_set\_height](#fun_table.cell_set_height)[table.cell\_set\_text](#fun_table.cell_set_text)[table.cell\_set\_text\_color](#fun_table.cell_set_text_color)[table.cell\_set\_text\_size](#fun_table.cell_set_text_size)[table.cell\_set\_text\_valign](#fun_table.cell_set_text_valign)[table.cell\_set\_width](#fun_table.cell_set_width)[table.cell\_set\_tooltip](#fun_table.cell_set_tooltip)
