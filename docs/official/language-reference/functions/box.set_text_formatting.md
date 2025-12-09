### box.set\_text\_formatting()

Sets the formatting attributes the drawing applies to displayed text.

Syntax

```
box.set_text_formatting(id, text_formatting) → void
```

Arguments

id (series box) A box object.

text\_formatting (const text\_format) The formatting of the displayed text. Formatting options support addition. For example, `text.format_bold + text.format_italic` will make the text both bold and italicized. Possible values: [text.format\_none](#var_text.format_none), [text.format\_bold](#var_text.format_bold), [text.format\_italic](#var_text.format_italic). Optional. The default is [text.format\_none](#var_text.format_none).

See also

[box.set\_text\_color](#fun_box.set_text_color)[box.set\_text\_size](#fun_box.set_text_size)[box.set\_text\_valign](#fun_box.set_text_valign)[box.set\_text\_halign](#fun_box.set_text_halign)[box.set\_text](#fun_box.set_text)
