### array.new\_label()

The function creates a new array object of label type elements.

Syntax

```
array.new_label(size, initial_value) → array<label>
```

Arguments

size (series int) Initial size of an array. Optional. The default is 0.

initial\_value (series label) Initial value of all array elements. Optional. The default is 'na'.

Example

```
//@version=6  
indicator("array.new_label example", overlay = true, max_labels_count = 500)  
  
//@variable The number of labels to show on the chart.  
int labelCount = input.int(50, "Labels to show", 1, 500)  
  
//@variable An array of `label` objects.  
var array<label> labelArray = array.new_label()  
  
//@variable A `chart.point` for the new label.  
labelPoint = chart.point.from_index(bar_index, close)  
//@variable The text in the new label.  
string labelText = na  
//@variable The color of the new label.  
color labelColor = na  
//@variable The style of the new label.  
string labelStyle = na  
  
// Set the label attributes for rising bars.  
if close > open  
    labelText  := "Rising"  
    labelColor := color.green  
    labelStyle := label.style_label_down  
// Set the label attributes for falling bars.  
else if close < open  
    labelText  := "Falling"  
    labelColor := color.red  
    labelStyle := label.style_label_up  
  
// Add a new label to the `labelArray` when the chart bar closed at a new value.  
if close != open  
    labelArray.push(label.new(labelPoint, labelText, color = labelColor, style = labelStyle))  
// Remove the first element and delete its label when the size of the `labelArray` exceeds the `labelCount`.  
if labelArray.size() > labelCount  
    label.delete(labelArray.shift())
```

Returns

The ID of an array object which may be used in other array.\*() functions.

Remarks

An array index starts from 0.

See also

[array.new\_float](#fun_array.new_float)[array.get](#fun_array.get)[array.slice](#fun_array.slice)
