### label

Keyword used to explicitly declare the "label" type of a variable or a parameter. Label objects (or IDs) can be created with the [label.new](#fun_label.new) function.

Example

```
//@version=6  
indicator("label")  
// Empty `label1` label ID.  
var label label1 = na  
// `label` type is unnecessary because `label.new()` returns "label" type.  
var label2 = label.new(na, na, na)  
if barstate.islastconfirmedhistory  
    label3 = label.new(bar_index, high, text = "label3 text")
```

Remarks

Label objects are always of "series" form.

See also

[var](#kw_var)[line](#type_line)[box](#type_box)[label.new](#fun_label.new)
