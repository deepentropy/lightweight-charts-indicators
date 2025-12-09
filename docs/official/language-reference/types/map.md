### map

Keyword used to explicitly declare the "map" type of a variable or a parameter. Map objects (or IDs) can be created with the [map.new<type,type>](#fun_map.new<type,type>) function.

Example

```
//@version=6  
indicator("map", overlay=true)  
map<int, float> a = na  
a := map.new<int, float>()  
a.put(bar_index, close)  
label.new(bar_index, a.get(bar_index), "Current close")
```

Remarks

Map objects are always of [series](https://www.tradingview.com/pine-script-docs/language/type-system/#series) form.

See also

[map.new<type,type>](#fun_map.new<type,type>)
