### table.cell\_set\_text\_font\_family()

The function sets the font family of the text inside the cell.

Syntax

```
table.cell_set_text_font_family(table_id, column, row, text_font_family) → void
```

Arguments

table\_id (series table) A table object.

column (series int) The index of the cell's column. Numbering starts at 0.

row (series int) The index of the cell's row. Numbering starts at 0.

text\_font\_family (series string) The font family of the text. Possible values: [font.family\_default](#const_font.family_default), [font.family\_monospace](#const_font.family_monospace).

Example

```
//@version=6  
indicator("Example of setting the table cell font")  
var t = table.new(position.top_left, rows = 1, columns = 1)  
table.cell(t, 0, 0, "monospace", text_color = color.blue)  
table.cell_set_text_font_family(t, 0, 0, font.family_monospace)
```

See also

[table.new](#fun_table.new)[font.family\_default](#const_font.family_default)[font.family\_monospace](#const_font.family_monospace)
