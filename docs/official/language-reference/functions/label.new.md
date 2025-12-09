### label.new()

2 overloads

Creates new label object.

Syntax & Overloads

[```
label.new(point, text, xloc, yloc, color, style, textcolor, size, textalign, tooltip, text_font_family, force_overlay, text_formatting) → series label
```](#fun_label.new-0)[```
label.new(x, y, text, xloc, yloc, color, style, textcolor, size, textalign, tooltip, text_font_family, force_overlay, text_formatting) → series label
```](#fun_label.new-1)

Arguments

point (chart.point) A [chart.point](#type_chart.point) object that specifies the label's location.

text (series string) Label text. Default is empty string.

xloc (series string) See description of **x** argument. Possible values: [xloc.bar\_index](#const_xloc.bar_index) and [xloc.bar\_time](#const_xloc.bar_time). Default is [xloc.bar\_index](#const_xloc.bar_index).

yloc (series string) Possible values are [yloc.price](#const_yloc.price), [yloc.abovebar](#const_yloc.abovebar), [yloc.belowbar](#const_yloc.belowbar). If yloc=[yloc.price](#const_yloc.price), **y** argument specifies the price of the label position. If yloc=[yloc.abovebar](#const_yloc.abovebar), label is located above bar. If yloc=[yloc.belowbar](#const_yloc.belowbar), label is located below bar. Default is [yloc.price](#const_yloc.price).

color (series color) Color of the label border and arrow

style (series string) Label style. Possible values: [label.style\_none](#const_label.style_none), [label.style\_xcross](#const_label.style_xcross), [label.style\_cross](#const_label.style_cross), [label.style\_triangleup](#const_label.style_triangleup), [label.style\_triangledown](#const_label.style_triangledown), [label.style\_flag](#const_label.style_flag), [label.style\_circle](#const_label.style_circle), [label.style\_arrowup](#const_label.style_arrowup), [label.style\_arrowdown](#const_label.style_arrowdown), [label.style\_label\_up](#const_label.style_label_up), [label.style\_label\_down](#const_label.style_label_down), [label.style\_label\_left](#const_label.style_label_left), [label.style\_label\_right](#const_label.style_label_right), [label.style\_label\_lower\_left](#const_label.style_label_lower_left), [label.style\_label\_lower\_right](#const_label.style_label_lower_right), [label.style\_label\_upper\_left](#const_label.style_label_upper_left), [label.style\_label\_upper\_right](#const_label.style_label_upper_right), [label.style\_label\_center](#const_label.style_label_center), [label.style\_square](#const_label.style_square), [label.style\_diamond](#const_label.style_diamond), [label.style\_text\_outline](#const_label.style_text_outline). Default is [label.style\_label\_down](#const_label.style_label_down).

textcolor (series color) Text color.

size (series int/string) Optional. Size of the label. Accepts a positive [int](#type_int) value or one of the built-in `size.*` constants. The constants and their equivalent numeric sizes are: [size.auto](#const_size.auto) (0), [size.tiny](#const_size.tiny) (~7), [size.small](#const_size.small) (~10), [size.normal](#const_size.normal) (12), [size.large](#const_size.large) (18), [size.huge](#const_size.huge) (24). The default value is [size.normal](#const_size.normal), which represents the numeric size of 12.

textalign (series string) Label text alignment. Possible values: [text.align\_left](#const_text.align_left), [text.align\_center](#const_text.align_center), [text.align\_right](#const_text.align_right). Default value is [text.align\_center](#const_text.align_center).

tooltip (series string) Hover to see tooltip label.

text\_font\_family (series string) The font family of the text. Optional. The default value is [font.family\_default](#const_font.family_default). Possible values: [font.family\_default](#const_font.family_default), [font.family\_monospace](#const_font.family_monospace).

force\_overlay (const bool) If [true](#const_true), the drawing will display on the main chart pane, even when the script occupies a separate pane. Optional. The default is [false](#const_false).

text\_formatting (const text\_format) The formatting of the displayed text. Formatting options support addition. For example, `text.format_bold + text.format_italic` will make the text both bold and italicized. Possible values: [text.format\_none](#var_text.format_none), [text.format\_bold](#var_text.format_bold), [text.format\_italic](#var_text.format_italic). Optional. The default is [text.format\_none](#var_text.format_none).

Example

```
//@version=6  
indicator("label.new")  
var label1 = label.new(bar_index, low, text="Hello, world!", style=label.style_circle)  
label.set_x(label1, 0)  
label.set_xloc(label1, time, xloc.bar_time)  
label.set_color(label1, color.red)  
label.set_size(label1, size.large)
```

Returns

Label ID object which may be passed to label.setXXX and label.getXXX functions.

See also

[label.delete](#fun_label.delete)[label.set\_x](#fun_label.set_x)[label.set\_y](#fun_label.set_y)[label.set\_xy](#fun_label.set_xy)[label.set\_xloc](#fun_label.set_xloc)[label.set\_yloc](#fun_label.set_yloc)[label.set\_color](#fun_label.set_color)[label.set\_textcolor](#fun_label.set_textcolor)[label.set\_style](#fun_label.set_style)[label.set\_size](#fun_label.set_size)[label.set\_textalign](#fun_label.set_textalign)[label.set\_tooltip](#fun_label.set_tooltip)[label.set\_text](#fun_label.set_text)[label.set\_text\_formatting](#fun_label.set_text_formatting)
