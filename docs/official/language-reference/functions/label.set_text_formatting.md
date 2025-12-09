### label.set\_text\_formatting()

Sets the formatting attributes the drawing applies to displayed text.

Syntax

```
label.set_text_formatting(id, text_formatting) → void
```

Arguments

id (series label) Label object.

text\_formatting (const text\_format) The formatting of the displayed text. Formatting options support addition. For example, `text.format_bold + text.format_italic` will make the text both bold and italicized. Possible values: [text.format\_none](#var_text.format_none), [text.format\_bold](#var_text.format_bold), [text.format\_italic](#var_text.format_italic). Optional. The default is [text.format\_none](#var_text.format_none).

See also

[label.new](#fun_label.new)[label.set\_text](#fun_label.set_text)
