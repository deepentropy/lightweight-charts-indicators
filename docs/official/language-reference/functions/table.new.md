### table.new()

The function creates a new table.

Syntax

```
table.new(position, columns, rows, bgcolor, frame_color, frame_width, border_color, border_width, force_overlay) → series table
```

Arguments

position (series string) Position of the table. Possible values are: [position.top\_left](#const_position.top_left), [position.top\_center](#const_position.top_center), [position.top\_right](#const_position.top_right), [position.middle\_left](#const_position.middle_left), [position.middle\_center](#const_position.middle_center), [position.middle\_right](#const_position.middle_right), [position.bottom\_left](#const_position.bottom_left), [position.bottom\_center](#const_position.bottom_center), [position.bottom\_right](#const_position.bottom_right).

columns (series int) The number of columns in the table.

rows (series int) The number of rows in the table.

bgcolor (series color) The background color of the table. Optional. The default is no color.

frame\_color (series color) The color of the outer frame of the table. Optional. The default is no color.

frame\_width (series int) The width of the outer frame of the table. Optional. The default is 0.

border\_color (series color) The color of the borders of the cells (excluding the outer frame). Optional. The default is no color.

border\_width (series int) The width of the borders of the cells (excluding the outer frame). Optional. The default is 0.

force\_overlay (const bool) If [true](#const_true), the drawing will display on the main chart pane, even when the script occupies a separate pane. Optional. The default is [false](#const_false).

Example

```
//@version=6  
indicator("table.new example")  
var testTable = table.new(position = position.top_right, columns = 2, rows = 1, bgcolor = color.yellow, border_width = 1)  
if barstate.islast  
    table.cell(table_id = testTable, column = 0, row = 0, text = "Open is " + str.tostring(open))  
    table.cell(table_id = testTable, column = 1, row = 0, text = "Close is " + str.tostring(close), bgcolor=color.teal)
```

Returns

The ID of a table object that can be passed to other table.\*() functions.

Remarks

This function creates the table object itself, but the table will not be displayed until its cells are populated. To define a cell and change its contents or attributes, use [table.cell](#fun_table.cell) and other table.cell\_\*() functions.

One [table.new](#fun_table.new) call can only display one table (the last one drawn), but the function itself will be recalculated on each bar it is used on. For performance reasons, it is wise to use [table.new](#fun_table.new) in conjunction with either the [var](#kw_var) keyword (so the table object is only created on the first bar) or in an [if](#kw_if) [barstate.islast](#var_barstate.islast) block (so the table object is only created on the last bar).

See also

[table.cell](#fun_table.cell)[table.clear](#fun_table.clear)[table.delete](#fun_table.delete)[table.set\_bgcolor](#fun_table.set_bgcolor)[table.set\_border\_color](#fun_table.set_border_color)[table.set\_border\_width](#fun_table.set_border_width)[table.set\_frame\_color](#fun_table.set_frame_color)[table.set\_frame\_width](#fun_table.set_frame_width)[table.set\_position](#fun_table.set_position)
