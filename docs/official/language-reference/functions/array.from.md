### array.from()

12 overloads

The function takes a variable number of arguments with one of the types: int, float, bool, string, label, line, color, box, table, linefill, and returns an array of the corresponding type.

Syntax & Overloads

[```
array.from(arg0, arg1, ...) → array<type>
```](#fun_array.from-0)[```
array.from(arg0, arg1, ...) → array<enum>
```](#fun_array.from-1)[```
array.from(arg0, arg1, ...) → array<label>
```](#fun_array.from-2)[```
array.from(arg0, arg1, ...) → array<line>
```](#fun_array.from-3)[```
array.from(arg0, arg1, ...) → array<box>
```](#fun_array.from-4)[```
array.from(arg0, arg1, ...) → array<table>
```](#fun_array.from-5)[```
array.from(arg0, arg1, ...) → array<linefill>
```](#fun_array.from-6)[```
array.from(arg0, arg1, ...) → array<string>
```](#fun_array.from-7)[```
array.from(arg0, arg1, ...) → array<color>
```](#fun_array.from-8)[```
array.from(arg0, arg1, ...) → array<int>
```](#fun_array.from-9)[```
array.from(arg0, arg1, ...) → array<float>
```](#fun_array.from-10)[```
array.from(arg0, arg1, ...) → array<bool>
```](#fun_array.from-11)

Arguments

arg0, arg1, ... (<arg...\_type>) Array arguments.

Example

```
//@version=6  
indicator("array.from_example", overlay = false)  
arr = array.from("Hello", "World!") // arr (array<string>) will contain 2 elements: {Hello}, {World!}.  
plot(close)
```

Returns

The array element's value.

Remarks

This function can accept up to 4,000 'int', 'float', 'bool', or 'color' arguments. For all other types, including user-defined types, the limit is 999.
