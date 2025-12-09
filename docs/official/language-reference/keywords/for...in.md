### for...in

Creates a collection-controlled loop, which iterates over the *elements* of an [array](#type_array), the *rows* of a [matrix](#type_matrix), or the *key-value pairs* of a [map](#type_map) in order. The loop's local code block executes once for each element, row, or pair in the specified collection.

Syntax

```
[variables = | :=] for item in collection_id
    statements | continue | break
    return_expression

[variables = | :=] for [index, item] in collection_id
    statements | continue | break
    return_expression
```

**variables (return\_expression type)** - Optional. A variable or tuple to hold the values or references from the last evaluation of `return_expression` after the loop terminates. The script can assign the loop's returned results to variables only if the results are not of the "void" type. If the loop's conditions prevent iteration, or if no iterations evaluate `return_expression`, the variables' assigned values or references are [na](#var_na), or `false` if the return type is "bool".

**index** - A variable to track the array element index, matrix row index, or map key of the current iteration. The loop cannot modify this variable using reassignment or compound assignment operators. This variable is valid only in the second form of the loop structure.

**item** - A variable to track the array element, matrix row, or map value element of the current iteration. The loop cannot modify this variable using reassignment or compound assignment operators.

**collection\_id (array/matrix/map)** - The ID of the array, matrix, or map whose items the loop iterates over.

**statements** - The code statements and expressions within the loop's body, i.e., the indented block of code beneath the loop header.

**return\_expression (any type)** - The last expression or statement within the loop's body. The loop returns the results from this code after the final iteration. If the loop stops prematurely due to a `continue` or `break` statement, the returned values or references are those of the latest iteration that evaluated this code. To use the loop's returned results, assign them to a variable or tuple.

**continue** - A loop-specific keyword that instructs the script to skip the remainder of the current loop iteration and continue to the next iteration.

**break** - A loop-specific keyword that prompts the script to stop the current iteration and exit the loop entirely.

The following example uses the first form of the `for...in` loop to count the number of array element values that are greater than a specified value:

Example

```
//@version=6  
indicator("'for...in' array (first form) demo")  
  
//@function Counts the number of 'id' array elements that are greater than the specified value.   
numGreaterThan(array<float> id, float value) =>  
    int result = 0  
    for element in id  
        if element > value  
            result += 1  
    result  
  
//@variable References an array containing the current bar's OHLC values.   
array<float> ohlcValues = array.from(open, high, low, close)  
  
// Plot the number of 'ohlcValues' elements that are greater than the 20-bar SMA of 'close'.   
plot(numGreaterThan(ohlcValues, ta.sma(close, 20)))
```

The example below uses the second form of the loop structure to perform element-wise addition between two arrays:

Example

```
//@version=6  
indicator("`for...in` array (second form) demo")  
  
//@function Creates a new array whose elements are the sums of corresponding elements in the `id1` and `id2` arrays.   
elementWiseAdd(array<float> id1, array<float> id2) =>  
    array<float> result = array.new<float>()  
    // Loop through the `id1` array while tracking each element's index *and* value.  
    for [index, element1] in id1  
        // Use `index` to retrieve the corresponding element in the `id2` array, then push the sum into the new array.  
        float element2 = id2.get(index)  
        result.push(element1 + element2)  
    result  
  
if barstate.isfirst  
    // Create two arrays for which to perform element-wise addition.  
    array<float> array1 = array.from(1.0, 2.0, 3.0, 4.0)  
    array<float> array2 = array.from(2.0, 3.0, 4.0, 5.0)  
  
    //@variable References the resulting array of element-wise sums.   
    array<float> sums = elementWiseAdd(array1, array2)  
    // Log a string representation of the `sums` array's contents in the Pine Logs pane.   
    log.info(str.tostring(sums))
```

This example uses the first form of the loop structure to iterate over the rows of a matrix and create an array containing each one's sum. The header's loop variable, `rowArrayID`, references an array containing the current row's values:

Example

```
//@version=6  
indicator("`for...in` matrix (first form) demo")  
  
//@function Creates a matrix that organizes the contents of the `arrayID` array into a specified shape.  
matrixFromArray(array<float> arrayID, int rows, int columns) =>  
    matrix<float> result = matrix.new<float>()  
    result.add_row(0, arrayID)  
    result.reshape(rows, columns)  
    result  
  
//@function Creates an array containing the sum of elements in each row of the `matrixID` matrix.  
calcRowSums(matrix<float> matrixID) =>  
    array<float> result = array.new<float>()  
    // Iterate over the matrix rows, where `rowArrayID` references an *array* containing the current row's values.   
    for rowArrayID in matrixID  
        // Push the sum of `rowArrayID` elements into the `result` array.   
        result.push(rowArrayID.sum())  
    result  
      
if barstate.isfirst  
    // Create a 2x2 matrix of pseudorandom values.  
    array<float>  randArray = array.from(math.random(), math.random(), math.random(), math.random())    
    matrix<float> randMat   = matrixFromArray(randArray, 2, 2)  
    // Log string representation of the `randMat` matrix and the calculated array of row sums in the Pine Logs pane.  
    log.info("\n" + str.tostring(randMat))  
    log.info(str.tostring(calcRowSums(randMat)))
```

The following example uses a `for...in` loop to iterate over a map's key-value pairs and construct a custom string representation of its contents:

Example

```
//@version=6  
indicator("`for...in` map demo")  
  
//@function Creates a custom string representation of a map containing "string" keys and "float" values.   
toString(map<string, float> id) =>  
    string result = "{"  
    // Iterate through the key-value pairs of the `id` map, in insertion order.   
    for [key, value] in id  
        result += str.format("''{0}'': {1}, ", key, value)  
    result += "}"  
    result := str.replace(result, ", }", "}")  
  
if barstate.islastconfirmedhistory  
    //@variable References a map to store "float" OHLC values with corresponding "string" keys.   
    map<string, float> ohlcMap = map.new<string, float>()  
    // Put key-value pairs into the map.   
    ohlcMap.put("Open",  open)  
    ohlcMap.put("High",  high)  
    ohlcMap.put("Low",   low)  
    ohlcMap.put("Close", close)  
    // Log the `toString()` result for the map referenced by `ohlcMap`.  
    log.info(toString(ohlcMap))
```

Remarks

Only the *second* form of the `for...in` loop is compatible with maps. The loop iterates over the key-value pairs of a map in the *insertion order* of its keys.

Scripts can modify the sizes of arrays and matrices while iterating over their contents with a `for...in` loop. However, they cannot modify the sizes of maps while looping over them directly with this structure. To modify a map while using a `for...in` loop, use the loop on a copy of the map or on the map's [map.keys](#fun_map.keys) array.

If a script initializes a variable declared with [var](#kw_var) or [varip](#kw_varip) using a loop's result, the loop stops after the *first* iteration, even if the header's criteria allow more iterations. Instead of initializing the variable with the result of this structure directly, declare the variable first and use [:=](#op_:=) to update it with the result. Alternatively, move the loop into a [Declaring functions](https://www.tradingview.com/pine-script-docs/language/user-defined-functions/) and initialize the variable using a call to that function.

See the [Loops](https://www.tradingview.com/pine-script-docs/language/loops/#loops) page of our User Manual to learn more about loops and how they work.

See also

[for](#kw_for)[while](#kw_while)[array.sum](#fun_array.sum)[array.min](#fun_array.min)[array.max](#fun_array.max)
