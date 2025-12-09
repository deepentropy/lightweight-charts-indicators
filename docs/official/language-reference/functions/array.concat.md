### array.concat()

The function is used to merge two arrays. It pushes all elements from the second array to the first array, and returns the first array.

Syntax

```
array.concat(id1, id2) → array<type>
```

Arguments

id1 (any array type) The first array object.

id2 (any array type) The second array object.

Example

```
//@version=6  
indicator("array.concat example")  
a = array.new_float(0,0)  
b = array.new_float(0,0)  
for i = 0 to 4  
    array.push(a, high[i])  
    array.push(b, low[i])  
c = array.concat(a,b)  
plot(array.size(a))  
plot(array.size(b))  
plot(array.size(c))
```

Returns

The first array with merged elements from the second array.

See also

[array.new\_float](#fun_array.new_float)[array.insert](#fun_array.insert)[array.slice](#fun_array.slice)
