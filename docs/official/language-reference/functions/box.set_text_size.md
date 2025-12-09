### box.set\_text\_size()

The function sets the size of the box's text.

Syntax

```
box.set_text_size(id, text_size) → void
```

Arguments

id (series box) A box object.

text\_size (series int/string) Size of the box's text. The size can be any positive integer, or one of the `size.*` built-in constant strings. The constant strings and their equivalent integer values are: [size.auto](#const_size.auto) (0), [size.tiny](#const_size.tiny) (8), [size.small](#const_size.small) (10), [size.normal](#const_size.normal) (14), [size.large](#const_size.large) (20), [size.huge](#const_size.huge) (36).

See also

[box.set\_text](#fun_box.set_text)[box.set\_text\_color](#fun_box.set_text_color)[box.set\_text\_valign](#fun_box.set_text_valign)[box.set\_text\_halign](#fun_box.set_text_halign)
