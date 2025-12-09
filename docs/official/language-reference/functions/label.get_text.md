### label.get\_text()

Returns the text of this label object.

Syntax

```
label.get_text(id) → series string
```

Arguments

id (series label) Label object.

Example

```
//@version=6  
indicator("label.get_text")  
my_label = label.new(time, open, text="Open bar text", xloc=xloc.bar_time)  
a = label.get_text(my_label)  
label.new(time, close, text = a + " new", xloc=xloc.bar_time)
```

Returns

String object containing the text of this label.

See also

[label.new](#fun_label.new)
