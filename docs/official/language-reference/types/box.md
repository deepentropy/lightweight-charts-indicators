### box

Keyword used to explicitly declare the "box" type of a variable or a parameter. Box objects (or IDs) can be created with the [box.new](#fun_box.new) function.

Example

```
//@version=6  
indicator("box")  
// Empty `box1` box ID.  
var box box1 = na  
// `box` type is unnecessary because `box.new()` returns a "box" type.  
var box2 = box.new(na, na, na, na)  
box3 = box.new(time, open, time + 60 * 60 * 24, close, xloc=xloc.bar_time)
```

Remarks

Box objects are always of "series" form.

See also

[var](#kw_var)[line](#type_line)[label](#type_label)[table](#type_table)[box.new](#fun_box.new)
