### map.values()

Returns an array of all the values in the `id` map. The resulting array is a copy and any changes to it are not reflected in the original map.

Syntax

```
map.values(id) → array<type>
```

Arguments

id (any map type) A map object.

Example

```
//@version=6  
indicator("map.values example")  
a = map.new<string, float>()  
a.put("open", open)  
a.put("high", high)  
a.put("low", low)  
a.put("close", close)  
values = map.values(a)  
ohlc = 0.0  
for value in values  
    ohlc += value  
plot(ohlc/4)
```

Remarks

Maps maintain insertion order. The elements within the array returned by this function will also be in the insertion order.

See also

[map.new<type,type>](#fun_map.new<type,type>)[map.put](#fun_map.put)[map.get](#fun_map.get)[map.keys](#fun_map.keys)[map.size](#fun_map.size)
