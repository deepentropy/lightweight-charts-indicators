### line.get\_x1()

Returns UNIX time or bar index (depending on the last xloc value set) of the first point of the line.

Syntax

```
line.get_x1(id) → series int
```

Arguments

id (series line) Line object.

Example

```
//@version=6  
indicator("line.get_x1")  
my_line = line.new(time, open, time + 60 * 60 * 24, close, xloc=xloc.bar_time)  
a = line.get_x1(my_line)  
plot(time - line.get_x1(my_line)) //draws zero plot
```

Returns

UNIX timestamp (in milliseconds) or bar index.

See also

[line.new](#fun_line.new)
