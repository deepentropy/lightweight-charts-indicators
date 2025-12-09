### export

Used in libraries to prefix the declaration of functions or user-defined type definitions that will be available from other scripts importing the library.

Example

```
//@version=6  
//@description Library of debugging functions.  
library("Debugging_library", overlay = true)  
//@function Displays a string as a table cell for debugging purposes.  
//@param txt String to display.  
//@returns Void.  
export print(string txt) =>  
    var table t = table.new(position.middle_right, 1, 1)  
    table.cell(t, 0, 0, txt, bgcolor = color.yellow)  
// Using the function from inside the library to show an example on the published chart.  
// This has no impact on scripts using the library.  
print("Library Test")
```

Remarks

Each library must have at least one exported function or user-defined type (UDT).

Exported functions cannot use variables from the global scope if they are arrays, mutable variables (reassigned with `:=`), or variables of 'input' form.

Exported functions cannot use `request.*()` functions.

Exported functions must explicitly declare each parameter's type and all parameters must be used in the function's body. By default, all arguments passed to exported functions are of the [series](#type_series) form, unless they are explicitly specified as [simple](#type_simple) in the function's signature.

The @description, @function, @param, @type, @field, and @returns compiler annotations are used to automatically generate the library's description and release notes, and in the Pine Script® Editor's tooltips.

See also

[library](#fun_library)[import](#kw_import)[simple](#type_simple)[series](#type_series)[type](#kw_type)
