### array.first()

Returns the array's first element. Throws a runtime error if the array is empty.

Syntax

```
array.first(id) → series <type>
```

Arguments

id (any array type) An array object.

Example

```
//@version=6  
indicator("array.first example")  
arr = array.new_int(3, 10)  
plot(array.first(arr))
```

See also

[array.last](#fun_array.last)[array.get](#fun_array.get)
