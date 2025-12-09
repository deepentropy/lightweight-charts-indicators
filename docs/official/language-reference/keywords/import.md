### import

Used to load an external [library](#fun_library) into a script and bind its functions to a namespace. The importing script can be an indicator, a strategy, or another library. A library must be published (privately or publicly) before it can be imported.

Syntax

```
import {username}/{libraryName}/{libraryVersion} as {alias}
```

Arguments

username (literal string) User name of the library's author.

libraryName (literal string) Name of the imported library, which corresponds to the `title` argument used by the author in his library script.

libraryVersion (literal int) Version number of the imported library.

alias (literal string) A non-numeric identifier used as a namespace to refer to the library's functions. Optional. The default is the `libraryName` string.

Example

```
//@version=6  
indicator("num_methods import")  
// Import the first version of the username’s "num_methods" library and assign it to the "m" namespace",  
import username/num_methods/1 as m  
// Call the “sinh()” function from the imported library  
y = m.sinh(3.14)  
// Plot value returned by the "sinh()" function",  
plot(y)
```

Remarks

Using an alias that replaces a built-in namespace such as math.\* or strategy.\* is allowed, but if the library contains function names that shadow Pine Script®'s built-in functions, the built-ins will become unavailable. The same version of a library can only be imported once. Aliases must be distinct for each imported library. When calling library functions, casting their arguments to types other than their declared type is not allowed. An import statement cannot use 'as' or 'import' as `username`, `libraryName`, or `alias` identifiers.

See also

[library](#fun_library)[export](#kw_export)
