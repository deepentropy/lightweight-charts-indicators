### map.put()

Puts a new key-value pair into the `id` map.

Syntax

```
map.put(id, key, value) → <value_type>
```

Arguments

id (any map type) A map object.

key (series <type of the map's elements>) The key to put into the map.

value (series <type of the map's elements>) The key value to put into the map.

Example

```
//@version=6  
indicator("map.put example")  
a = map.new<string, float>()  
map.put(a, "first", 10)  
map.put(a, "second", 15)  
prevFirst = map.put(a, "first", 20)  
currFirst = a.get("first")  
plot(prevFirst)  
plot(currFirst)
```

Returns

The previous value associated with `key` if the key was already present in the map, or [na](#var_na) if the key is new.

Remarks

Maps maintain insertion order. Note that the order does not change when inserting a pair with a `key` that's already in the map. The new pair replaces the existing pair with the `key` in such cases.

See also

[map.new<type,type>](#fun_map.new<type,type>)[map.put\_all](#fun_map.put_all)[map.keys](#fun_map.keys)[map.values](#fun_map.values)[map.remove](#fun_map.remove)
