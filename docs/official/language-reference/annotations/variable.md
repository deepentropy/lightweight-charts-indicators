### @variable

If placed above a variable declaration, it adds a custom description for the variable.

The Pine Editor's autosuggest uses this description and displays it when a user hovers over the variable name.

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
