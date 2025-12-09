### map.clear()

Clears the map, removing all key-value pairs from it.

Syntax

```
map.clear(id) → void
```

Arguments

id (any map type) A map object.

Example

```
//@version=6  
indicator("map.clear example")  
oddMap = map.new<int, bool>()  
oddMap.put(1, true)  
oddMap.put(2, false)  
oddMap.put(3, true)  
map.clear(oddMap)  
plot(oddMap.size())
```

See also

[map.new<type,type>](#fun_map.new<type,type>)[map.put\_all](#fun_map.put_all)[map.keys](#fun_map.keys)[map.values](#fun_map.values)[map.remove](#fun_map.remove)
