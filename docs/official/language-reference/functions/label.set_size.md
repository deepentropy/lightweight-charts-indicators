### label.set\_size()

Sets arrow and text size of the specified label object.

Syntax

```
label.set_size(id, size) → void
```

Arguments

id (series label) Label object.

size (series int/string) Size of the label. Accepts a positive [int](#type_int) value or one of the built-in `size.*` constants. The constants and their equivalent numeric sizes are: [size.auto](#const_size.auto) (0), [size.tiny](#const_size.tiny) (~7), [size.small](#const_size.small) (~10), [size.normal](#const_size.normal) (12), [size.large](#const_size.large) (18), [size.huge](#const_size.huge) (24). The default value is [size.normal](#const_size.normal), which represents the numeric size of 12.

See also

[size.auto](#const_size.auto)[size.tiny](#const_size.tiny)[size.small](#const_size.small)[size.normal](#const_size.normal)[size.large](#const_size.large)[size.huge](#const_size.huge)[label.new](#fun_label.new)
