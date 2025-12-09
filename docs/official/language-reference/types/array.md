### array

Keyword used to explicitly declare the "array" type of a variable or a parameter. Array objects (or IDs) can be created with the [array.new<type>](#fun_array.new<type>), [array.from](#fun_array.from) function.

Example

```
//@version=6  
indicator("array", overlay=true)  
array<float> a = na  
a := array.new<float>(1, close)  
plot(array.get(a, 0))
```

Remarks

Array objects are always of "series" form.

See also

[var](#kw_var)[line](#type_line)[label](#type_label)[table](#type_table)[box](#type_box)[array.new<type>](#fun_array.new<type>)[array.from](#fun_array.from)
