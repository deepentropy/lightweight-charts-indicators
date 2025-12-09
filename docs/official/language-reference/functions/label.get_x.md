### label.get\_x()

Returns UNIX time or bar index (depending on the last xloc value set) of this label's position.

Syntax

```
label.get_x(id) → series int
```

Arguments

id (series label) Label object.

Example

```
//@version=6  
indicator("label.get_x")  
my_label = label.new(time, open, text="Open bar text", xloc=xloc.bar_time)  
a = label.get_x(my_label)  
plot(time - label.get_x(my_label)) //draws zero plot
```

Returns

UNIX timestamp (in milliseconds) or bar index.

See also

[label.new](#fun_label.new)
