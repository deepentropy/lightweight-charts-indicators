### method

This keyword is used to prefix a function declaration, indicating it can then be invoked using dot notation by appending its name to a variable of the type of its first parameter and omitting that first parameter. Alternatively, functions declared as methods can also be invoked like normal user-defined functions. In that case, an argument must be supplied for its first parameter.

The first parameter of a method declaration must be explicitly typified.

Syntax

```
[export] method <functionName>(<paramType> <paramName> [= <defaultValue>], …) =>
    <functionBlock>
```

Example

```
//@version=6  
indicator("")  
  
var prices = array.new<float>()  
  
//@function Pushes a new value into the array and removes the first one if the resulting array is greater than `maxSize`. Can be used as a method.  
method maintainArray(array<float> id, maxSize, value) =>  
    id.push(value)  
    if id.size() > maxSize  
        id.shift()  
  
prices.maintainArray(50, close)  
// The method can also be called like a function, without using dot notation.  
// In this case an argument must be supplied for its first parameter.  
// maintainArray(prices, 50, close)  
  
// This calls the `array.avg()` built-in using dot notation with the `prices` array.  
// It is possible because built-in functions belonging to some namespaces that are a special Pine type  
// can be invoked with method notation when the function's first parameter is an ID of that type.  
// Those namespaces are: `array`, `matrix`, `line`, `linefill`, `label`, `box`, and `table`.  
plot(prices.avg())
```
