### table.cell\_set\_text\_size()

The function sets the size of the cell's text.

Syntax

```
table.cell_set_text_size(table_id, column, row, text_size) → void
```

Arguments

table\_id (series table) A table object.

column (series int) The index of the cell's column. Numbering starts at 0.

row (series int) The index of the cell's row. Numbering starts at 0.

text\_size (series int/string) Size of the object. The size can be any positive integer, or one of the size.\* built-in constant strings. The constant strings and their equivalent integer values are: [size.auto](#const_size.auto) (0), [size.tiny](#const_size.tiny) (8), [size.small](#const_size.small) (10), [size.normal](#const_size.normal) (14), [size.large](#const_size.large) (20), [size.huge](#const_size.huge) (36). The default value is [size.normal](#const_size.normal) or 14.

See also

[table.cell\_set\_bgcolor](#fun_table.cell_set_bgcolor)[table.cell\_set\_height](#fun_table.cell_set_height)[table.cell\_set\_text](#fun_table.cell_set_text)[table.cell\_set\_text\_color](#fun_table.cell_set_text_color)[table.cell\_set\_text\_halign](#fun_table.cell_set_text_halign)[table.cell\_set\_text\_valign](#fun_table.cell_set_text_valign)[table.cell\_set\_width](#fun_table.cell_set_width)[table.cell\_set\_tooltip](#fun_table.cell_set_tooltip)
