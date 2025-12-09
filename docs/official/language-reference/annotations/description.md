### @description

Sets a custom description for scripts that use the [library](#fun_library) declaration statement. The text provided with this annotation will be used to pre-fill the "Description" field in the publication dialogue.

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
