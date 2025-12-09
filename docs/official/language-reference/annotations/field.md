### @field

If placed above a [type](#kw_type) or [enum](#kw_enum) declaration, it adds a custom description for a field of the type/enum. After the annotation, users should specify the field name, followed by its description.

The Pine Editor's autosuggest uses this description and displays it when a user hovers over the type/enum or field name. When used in [library](#fun_library) scripts, the descriptions of all types/enums using the [export](#kw_export) keyword will pre-fill the "Description" field in the publication dialogue.

Example

```
//@version=6  
indicator("New high over the last 20 bars", overlay = true)  
  
//@type A point on a chart.  
//@field index The index of the bar where the point is located, i.e., its `x` coordinate.  
//@field price The price where the point is located, i.e., its `y` coordinate.  
type Point  
    int index  
    float price  
  
//@variable If the current `high` is the highest over the last 20 bars, returns a new `Point` instance, `na` otherwise.  
Point highest = na  
  
if ta.highestbars(high, 20) == 0  
    highest := Point.new(bar_index, high)  
    label.new(highest.index, highest.price, str.tostring(highest.price))
```
