### map.size()

Returns the number of key-value pairs in the `id` map.

Syntax

```
map.size(id) → series int
```

Arguments

id (any map type) A map object.

Example

```
//@version=6  
indicator("map.size example")  
a = map.new<int, int>()  
size = 10  
for i = 0 to size  
    a.put(i, size-i)  
plot(map.size(a))
```

See also

[map.new<type,type>](#fun_map.new<type,type>)[map.put](#fun_map.put)[map.keys](#fun_map.keys)[map.values](#fun_map.values)[map.get](#fun_map.get)
