### box.set\_text\_font\_family()

The function sets the font family of the text inside the box.

Syntax

```
box.set_text_font_family(id, text_font_family) → void
```

Arguments

id (series box) A box object.

text\_font\_family (series string) The font family of the text. Possible values: [font.family\_default](#const_font.family_default), [font.family\_monospace](#const_font.family_monospace).

Example

```
//@version=6  
indicator("Example of setting the box font")  
if barstate.islastconfirmedhistory  
    b = box.new(bar_index, open-ta.tr, bar_index-50, open-ta.tr*5, text="monospace")  
    box.set_text_font_family(b, font.family_monospace)
```

See also

[box.new](#fun_box.new)[font.family\_default](#const_font.family_default)[font.family\_monospace](#const_font.family_monospace)
