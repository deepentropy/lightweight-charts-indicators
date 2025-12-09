### array.standardize()

2 overloads

The function returns the array of standardized elements.

Syntax & Overloads

[```
array.standardize(id) → array<float>
```](#fun_array.standardize-0)[```
array.standardize(id) → array<int>
```](#fun_array.standardize-1)

Arguments

id (array<int/float>) An array object.

Example

```
//@version=6  
indicator("array.standardize example")  
a = array.new_float(0)  
for i = 0 to 9  
    array.push(a, close[i])  
b = array.standardize(a)  
plot(array.min(b))  
plot(array.max(b))
```

Returns

The array of standardized elements.

See also

[array.max](#fun_array.max)[array.min](#fun_array.min)[array.mode](#fun_array.mode)[array.avg](#fun_array.avg)[array.variance](#fun_array.variance)[array.stdev](#fun_array.stdev)
