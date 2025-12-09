### table.cell()

The function defines a cell in the table and sets its attributes.

Syntax

```
table.cell(table_id, column, row, text, width, height, text_color, text_halign, text_valign, text_size, bgcolor, tooltip, text_font_family, text_formatting) → void
```

Arguments

table\_id (series table) A table object.

column (series int) The index of the cell's column. Numbering starts at 0.

row (series int) The index of the cell's row. Numbering starts at 0.

text (series string) The text to be displayed inside the cell. Optional. The default is empty string.

width (series int/float) The width of the cell as a % of the indicator's visual space. Optional. By default, auto-adjusts the width based on the text inside the cell. Value 0 has the same effect.

height (series int/float) The height of the cell as a % of the indicator's visual space. Optional. By default, auto-adjusts the height based on the text inside of the cell. Value 0 has the same effect.

text\_color (series color) The color of the text. Optional. The default is [color.black](#const_color.black).

text\_halign (series string) The horizontal alignment of the cell's text. Optional. The default value is [text.align\_center](#const_text.align_center). Possible values: [text.align\_left](#const_text.align_left), [text.align\_center](#const_text.align_center), [text.align\_right](#const_text.align_right).

text\_valign (series string) The vertical alignment of the cell's text. Optional. The default value is [text.align\_center](#const_text.align_center). Possible values: [text.align\_top](#const_text.align_top), [text.align\_center](#const_text.align_center), [text.align\_bottom](#const_text.align_bottom).

text\_size (series int/string) Size of the object. The size can be any positive integer, or one of the size.\* built-in constant strings. The constant strings and their equivalent integer values are: [size.auto](#const_size.auto) (0), [size.tiny](#const_size.tiny) (8), [size.small](#const_size.small) (10), [size.normal](#const_size.normal) (14), [size.large](#const_size.large) (20), [size.huge](#const_size.huge) (36). The default value is [size.normal](#const_size.normal) or 14.

bgcolor (series color) The background color of the text. Optional. The default is no color.

tooltip (series string) The tooltip to be displayed inside the cell. Optional.

text\_font\_family (series string) The font family of the text. Optional. The default value is [font.family\_default](#const_font.family_default). Possible values: [font.family\_default](#const_font.family_default), [font.family\_monospace](#const_font.family_monospace).

text\_formatting (const text\_format) The formatting of the displayed text. Formatting options support addition. For example, `text.format_bold + text.format_italic` will make the text both bold and italicized. Possible values: [text.format\_none](#var_text.format_none), [text.format\_bold](#var_text.format_bold), [text.format\_italic](#var_text.format_italic). Optional. The default is [text.format\_none](#var_text.format_none).

Remarks

This function does not create the table itself, but defines the table’s cells. To use it, you first need to create a table object with [table.new](#fun_table.new).

Each [table.cell](#fun_table.cell) call overwrites all previously defined properties of a cell. If you call [table.cell](#fun_table.cell) twice in a row, e.g., the first time with text='Test Text', and the second time with text\_color=[color.red](#const_color.red) but without a new text argument, the default value of the 'text' being an empty string, it will overwrite 'Test Text', and your cell will display an empty string. If you want, instead, to modify any of the cell's properties, use the table.cell\_set\_\*() functions.

A single script can only display one table in each of the possible locations. If [table.cell](#fun_table.cell) is used on several bars to change the same attribute of a cell (e.g. change the background color of the cell to red on the first bar, then to yellow on the second bar), only the last change will be reflected in the table, i.e., the cell’s background will be yellow. Avoid unnecessary setting of cell properties by enclosing function calls in an [if](#kw_if) [barstate.islast](#var_barstate.islast) block whenever possible, to restrict their execution to the last bar of the series.

See also

[table.cell\_set\_bgcolor](#fun_table.cell_set_bgcolor)[table.cell\_set\_height](#fun_table.cell_set_height)[table.cell\_set\_text](#fun_table.cell_set_text)[table.cell\_set\_text\_formatting](#fun_table.cell_set_text_formatting)[table.cell\_set\_text\_color](#fun_table.cell_set_text_color)[table.cell\_set\_text\_halign](#fun_table.cell_set_text_halign)[table.cell\_set\_text\_size](#fun_table.cell_set_text_size)[table.cell\_set\_text\_valign](#fun_table.cell_set_text_valign)[table.cell\_set\_width](#fun_table.cell_set_width)[table.cell\_set\_tooltip](#fun_table.cell_set_tooltip)
