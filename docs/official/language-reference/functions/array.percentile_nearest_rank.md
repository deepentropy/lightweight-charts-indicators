### array.percentile\_nearest\_rank()

2 overloads

Returns the value for which the specified percentage of array values (percentile) are less than or equal to it, using the nearest-rank method.

Syntax & Overloads

[```
array.percentile_nearest_rank(id, percentage) → series float
```](#fun_array.percentile_nearest_rank-0)[```
array.percentile_nearest_rank(id, percentage) → series int
```](#fun_array.percentile_nearest_rank-1)

Arguments

id (array<int/float>) An array object.

percentage (series int/float) The percentage of values that must be equal or less than the returned value.

Remarks

In statistics, the percentile is the percent of ranking items that appear at or below a certain score. This measurement shows the percentage of scores within a standard frequency distribution that is lower than the percentile rank you're measuring.

Returns [na](#var_na) if the `id` array is empty.

See also

[array.new\_float](#fun_array.new_float)[array.insert](#fun_array.insert)[array.slice](#fun_array.slice)[array.reverse](#fun_array.reverse)[order.ascending](#const_order.ascending)[order.descending](#const_order.descending)
