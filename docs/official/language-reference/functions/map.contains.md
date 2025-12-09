### map.contains()

Returns [true](#const_true) if the `key` was found in the `id` map, [false](#const_false) otherwise.

Syntax

```
map.contains(id, key) → series bool
```

Arguments

id (any map type) A map object.

key (series <type of the map's elements>) The key to search in the map.

Example

```
//@version=6  
indicator("map.includes example")  
a = map.new<string, float>()  
a.put("open", open)  
p = close  
if map.contains(a, "open")  
    p := a.get("open")  
plot(p)
```

See also

[map.new<type,type>](#fun_map.new<type,type>)[map.put](#fun_map.put)[map.keys](#fun_map.keys)[map.values](#fun_map.values)[map.size](#fun_map.size)
