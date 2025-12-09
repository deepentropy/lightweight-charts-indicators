### array.percentrank()

2 overloads

Returns the percentile rank of the element at the specified `index`.

Syntax & Overloads

[```
array.percentrank(id, index) → series float
```](#fun_array.percentrank-0)[```
array.percentrank(id, index) → series int
```](#fun_array.percentrank-1)

Arguments

id (array<int/float>) An array object.

index (series int) The index of the element for which the percentile rank should be calculated.

Remarks

Percentile rank is the number of elements in the array that are less than or equal to the reference value, expressed as a percentage.

Returns [na](#var_na) if the `id` array is empty.

See also

[array.new\_float](#fun_array.new_float)[array.insert](#fun_array.insert)[array.slice](#fun_array.slice)[array.reverse](#fun_array.reverse)[order.ascending](#const_order.ascending)[order.descending](#const_order.descending)
