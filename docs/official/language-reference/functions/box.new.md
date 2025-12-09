### box.new()

2 overloads

Creates a new box object.

Syntax & Overloads

[```
box.new(top_left, bottom_right, border_color, border_width, border_style, extend, xloc, bgcolor, text, text_size, text_color, text_halign, text_valign, text_wrap, text_font_family, force_overlay, text_formatting) → series box
```](#fun_box.new-0)[```
box.new(left, top, right, bottom, border_color, border_width, border_style, extend, xloc, bgcolor, text, text_size, text_color, text_halign, text_valign, text_wrap, text_font_family, force_overlay, text_formatting) → series box
```](#fun_box.new-1)

Arguments

top\_left (chart.point) A [chart.point](#type_chart.point) object that specifies the top-left corner location of the box.

bottom\_right (chart.point) A [chart.point](#type_chart.point) object that specifies the bottom-right corner location of the box.

border\_color (series color) Color of the four borders. Optional. The default is [color.blue](#const_color.blue).

border\_width (series int) Width of the four borders, in pixels. Optional. The default is 1 pixel.

border\_style (series string) Style of the four borders. Possible values: [line.style\_solid](#const_line.style_solid), [line.style\_dotted](#const_line.style_dotted), [line.style\_dashed](#const_line.style_dashed). Optional. The default value is [line.style\_solid](#const_line.style_solid).

extend (series string) When [extend.none](#const_extend.none) is used, the horizontal borders start at the left border and end at the right border. With [extend.left](#const_extend.left) or [extend.right](#const_extend.right), the horizontal borders are extended indefinitely to the left or right of the box, respectively. With [extend.both](#const_extend.both), the horizontal borders are extended on both sides. Optional. The default value is [extend.none](#const_extend.none).

xloc (series string) Determines whether the arguments to 'left' and 'right' are a bar index or a time value. If xloc = [xloc.bar\_index](#const_xloc.bar_index), the arguments must be a bar index. If xloc = [xloc.bar\_time](#const_xloc.bar_time), the arguments must be a UNIX time. Possible values: [xloc.bar\_index](#const_xloc.bar_index) and [xloc.bar\_time](#const_xloc.bar_time). Optional. The default is [xloc.bar\_index](#const_xloc.bar_index).

bgcolor (series color) Background color of the box. Optional. The default is [color.blue](#const_color.blue).

text (series string) The text to be displayed inside the box. Optional. The default is empty string.

text\_size (series int/string) Optional. Size of the box's text. The size can be any positive integer, or one of the `size.*` built-in constant strings. The constant strings and their equivalent integer values are: [size.auto](#const_size.auto) (0), [size.tiny](#const_size.tiny) (8), [size.small](#const_size.small) (10), [size.normal](#const_size.normal) (14), [size.large](#const_size.large) (20), [size.huge](#const_size.huge) (36). The default value is [size.auto](#const_size.auto) or 0.

text\_color (series color) The color of the text. Optional. The default is [color.black](#const_color.black).

text\_halign (series string) The horizontal alignment of the box's text. Optional. The default value is [text.align\_center](#const_text.align_center). Possible values: [text.align\_left](#const_text.align_left), [text.align\_center](#const_text.align_center), [text.align\_right](#const_text.align_right).

text\_valign (series string) The vertical alignment of the box's text. Optional. The default value is [text.align\_center](#const_text.align_center). Possible values: [text.align\_top](#const_text.align_top), [text.align\_center](#const_text.align_center), [text.align\_bottom](#const_text.align_bottom).

text\_wrap (series string) Optional. Whether to wrap text. Wrapped text starts a new line when it reaches the side of the box. Wrapped text lower than the bottom of the box is not displayed. Unwrapped text stays on a single line and *is displayed* past the width of the box if it is too long. If the `text_size` is 0 or [text.wrap\_auto](#const_text.wrap_auto), this setting has no effect. The default value is [text.wrap\_none](#const_text.wrap_none). Possible values: [text.wrap\_none](#const_text.wrap_none), [text.wrap\_auto](#const_text.wrap_auto).

text\_font\_family (series string) The font family of the text. Optional. The default value is [font.family\_default](#const_font.family_default). Possible values: [font.family\_default](#const_font.family_default), [font.family\_monospace](#const_font.family_monospace).

force\_overlay (const bool) If [true](#const_true), the drawing will display on the main chart pane, even when the script occupies a separate pane. Optional. The default is [false](#const_false).

text\_formatting (const text\_format) The formatting of the displayed text. Formatting options support addition. For example, `text.format_bold + text.format_italic` will make the text both bold and italicized. Possible values: [text.format\_none](#var_text.format_none), [text.format\_bold](#var_text.format_bold), [text.format\_italic](#var_text.format_italic). Optional. The default is [text.format\_none](#var_text.format_none).

Example

```
//@version=6  
indicator("box.new")  
var b = box.new(time, open, time + 60 * 60 * 24, close, xloc=xloc.bar_time, border_style=line.style_dashed)  
box.set_lefttop(b, time, 100)  
box.set_rightbottom(b, time + 60 * 60 * 24, 500)  
box.set_bgcolor(b, color.green)
```

Returns

The ID of a box object which may be used in box.set\_\*() and box.get\_\*() functions.

See also

[box.delete](#fun_box.delete)[box.get\_left](#fun_box.get_left)[box.get\_top](#fun_box.get_top)[box.get\_right](#fun_box.get_right)[box.get\_bottom](#fun_box.get_bottom)[box.set\_top\_left\_point](#fun_box.set_top_left_point)[box.set\_left](#fun_box.set_left)[box.set\_top](#fun_box.set_top)[box.set\_bottom\_right\_point](#fun_box.set_bottom_right_point)[box.set\_right](#fun_box.set_right)[box.set\_bottom](#fun_box.set_bottom)[box.set\_border\_color](#fun_box.set_border_color)[box.set\_bgcolor](#fun_box.set_bgcolor)[box.set\_border\_width](#fun_box.set_border_width)[box.set\_border\_style](#fun_box.set_border_style)[box.set\_extend](#fun_box.set_extend)[box.set\_text](#fun_box.set_text)[box.set\_text\_formatting](#fun_box.set_text_formatting)[box.set\_xloc](#fun_box.set_xloc)
