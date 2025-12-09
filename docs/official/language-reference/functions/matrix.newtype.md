### matrix.new<type>()

The function creates a new matrix object. A matrix is a two-dimensional data structure containing rows and columns. All elements in the matrix must be of the type specified in the type template ("<type>").

Syntax

```
matrix.new<type>(rows, columns, initial_value) → matrix<type>
```

Arguments

rows (series int) Initial row count of the matrix. Optional. The default value is 0.

columns (series int) Initial column count of the matrix. Optional. The default value is 0.

initial\_value (<matrix\_type>) Initial value of all matrix elements. Optional. The default is 'na'.

Create a matrix of elements with the same initial value

Example

```
//@version=6  
indicator("`matrix.new<type>()` Example 1")  
  
// Create a 2x3 (2 rows x 3 columns) "int" matrix with values zero.  
var m = matrix.new<int>(2, 3, 0)  
  
// Display using a label.  
if barstate.islastconfirmedhistory  
    label.new(bar_index, high, str.tostring(m))
```

Create a matrix from array values

Example

```
//@version=6  
indicator("`matrix.new<type>()` Example 2")  
  
// Function to create a matrix whose rows are filled with array values.  
matrixFromArray(int rows, int columns, array<float> data) =>  
    m = matrix.new<float>(rows, columns)  
    for i = 0 to rows <= 0 ? na : rows - 1  
        for j = 0 to columns <= 0 ? na : columns - 1  
            matrix.set(m, i, j, array.get(data, i * columns + j))  
    m  
  
// Create a 3x3 matrix from an array of values.  
var m1 = matrixFromArray(3, 3, array.from(1, 2, 3, 4, 5, 6, 7, 8, 9))  
// Display using a label.  
if barstate.islastconfirmedhistory  
    label.new(bar_index, high, str.tostring(m1))
```

Create a matrix from an `input.text_area()` field

Example

```
//@version=6  
indicator("`matrix.new<type>()` Example 3")  
  
// Function to create a matrix from a text string.  
// Values in a row must be separated by a space. Each line is one row.  
matrixFromInputArea(stringOfValues) =>  
    var rowsArray = str.split(stringOfValues, "\n")  
    var rows = array.size(rowsArray)  
    var cols = array.size(str.split(array.get(rowsArray, 0), " "))  
    var matrix = matrix.new<float>(rows, cols, na)  
    row = 0  
    for rowString in rowsArray  
        col = 0  
        values = str.split(rowString, " ")  
        for val in values  
            matrix.set(matrix, row, col, str.tonumber(val))  
            col += 1  
        row += 1  
    matrix  
  
  
stringInput = input.text_area("1 2 3\n4 5 6\n7 8 9")  
var m = matrixFromInputArea(stringInput)  
  
// Display using a label.  
if barstate.islastconfirmedhistory  
    label.new(bar_index, high, str.tostring(m))
```

Create matrix from random values

Example

```
//@version=6  
indicator("`matrix.new<type>()` Example 4")  
  
// Function to create a matrix with random values (0.0 to 1.0).  
matrixRandom(int rows, int columns)=>  
    result = matrix.new<float>(rows, columns)  
    for i = 0 to rows - 1  
        for j = 0 to columns - 1  
            matrix.set(result, i, j, math.random())  
    result  
  
// Create a 2x3 matrix with random values.  
var m = matrixRandom(2, 3)  
  
// Display using a label.  
if barstate.islastconfirmedhistory  
    label.new(bar_index, high, str.tostring(m))
```

Returns

The ID of the new matrix object.

See also

[matrix.set](#fun_matrix.set)[matrix.fill](#fun_matrix.fill)[matrix.columns](#fun_matrix.columns)[matrix.rows](#fun_matrix.rows)[array.new<type>](#fun_array.new<type>)
