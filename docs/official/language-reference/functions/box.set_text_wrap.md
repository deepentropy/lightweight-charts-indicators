### box.set\_text\_wrap()

The function sets the mode of wrapping of the text inside the box.

Syntax

```
box.set_text_wrap(id, text_wrap) → void
```

Arguments

id (series box) A box object.

text\_wrap (series string) Whether to wrap text. Wrapped text starts a new line when it reaches the side of the box. Wrapped text lower than the bottom of the box is not displayed. Unwrapped text stays on a single line and *is displayed* past the width of the box if it is too long. If the `text_size` is 0 or [text.wrap\_auto](#const_text.wrap_auto), this setting has no effect. Possible values: [text.wrap\_none](#const_text.wrap_none), [text.wrap\_auto](#const_text.wrap_auto).

See also

[box.set\_text](#fun_box.set_text)[box.set\_text\_size](#fun_box.set_text_size)[box.set\_text\_valign](#fun_box.set_text_valign)[box.set\_text\_halign](#fun_box.set_text_halign)[box.set\_text\_color](#fun_box.set_text_color)
