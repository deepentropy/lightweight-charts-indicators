### array.last()

Returns the array's last element. Throws a runtime error if the array is empty.

Syntax

```
array.last(id) → series <type>
```

Arguments

id (any array type) An array object.

Example

```
//@version=6  
indicator("array.last example")  
arr = array.new_int(3, 10)  
plot(array.last(arr))
```

See also

[array.first](#fun_array.first)[array.get](#fun_array.get)
