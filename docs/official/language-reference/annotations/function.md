### @function

If placed above a function declaration, it adds a custom description for the function.

The Pine Editor's autosuggest uses this description and displays it when a user hovers over the function name. When used in [library](#fun_library) scripts, the descriptions of all functions using the [export](#kw_export) keyword will pre-fill the "Description" field in the publication dialogue.

Example

```
//@version=6  
// @description Provides a tool to quickly output a label on the chart.  
library("MyLibrary")  
  
// @function Outputs a label with `labelText` on the bar's high.  
// @param labelText (series string) The text to display on the label.  
// @returns Drawn label.  
export drawLabel(string labelText) =>  
    label.new(bar_index, high, text = labelText)
```
