### map.copy()

Creates a copy of an existing map.

Syntax

```
map.copy(id) → map<keyType, valueType>
```

Arguments

id (any map type) A map object to copy.

Example

```
//@version=6  
indicator("map.copy example")  
a = map.new<string, int>()  
a.put("example", 1)  
b = map.copy(a)  
a := map.new<string, int>()  
a.put("example", 2)  
plot(a.get("example"))  
plot(b.get("example"))
```

Returns

A copy of the `id` map.

See also

[map.new<type,type>](#fun_map.new<type,type>)[map.put](#fun_map.put)[map.keys](#fun_map.keys)[map.values](#fun_map.values)[map.get](#fun_map.get)[map.size](#fun_map.size)
