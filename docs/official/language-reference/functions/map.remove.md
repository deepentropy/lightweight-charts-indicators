### map.remove()

Removes a key-value pair from the `id` map.

Syntax

```
map.remove(id, key) → <value_type>
```

Arguments

id (any map type) A map object.

key (series <type of the map's elements>) The key of the pair to remove from the map.

Example

```
//@version=6  
indicator("map.remove example")  
a = map.new<string, color>()  
a.put("firstColor", color.green)  
oldColorValue = map.remove(a, "firstColor")  
plot(close, color = oldColorValue)
```

Returns

The previous value associated with `key` if the key was present in the map, or [na](#var_na) if there was no such key.

See also

[map.new<type,type>](#fun_map.new<type,type>)[map.put](#fun_map.put)[map.keys](#fun_map.keys)[map.values](#fun_map.values)[map.clear](#fun_map.clear)
