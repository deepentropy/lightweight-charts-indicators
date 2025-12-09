### label.set\_text\_font\_family()

The function sets the font family of the text inside the label.

Syntax

```
label.set_text_font_family(id, text_font_family) → void
```

Arguments

id (series label) A label object.

text\_font\_family (series string) The font family of the text. Possible values: [font.family\_default](#const_font.family_default), [font.family\_monospace](#const_font.family_monospace).

Example

```
//@version=6  
indicator("Example of setting the label font")  
if barstate.islastconfirmedhistory  
    l = label.new(bar_index, 0, "monospace", yloc=yloc.abovebar)  
    label.set_text_font_family(l, font.family_monospace)
```

See also

[label.new](#fun_label.new)[font.family\_default](#const_font.family_default)[font.family\_monospace](#const_font.family_monospace)
