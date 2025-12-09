### for

Creates a count-controlled loop, which uses a counter variable to manage the iterative executions of its local code block. The loop continues new iterations until the counter reaches a specified final value.

Syntax

```
[variables =|:=] for counter = from_num to to_num [by step_num]
    statements | continue | break
    return_expression
```

**variables (return\_expression type)** Optional. A variable or tuple to hold the values or references from the last evaluation of `return_expression` after the loop terminates. The script can assign the loop's returned results to variables only if the results are not of the "void" type. If the loop's conditions prevent iteration, or if no iterations evaluate `return_expression`, the variables' assigned values or references are [na](#var_na), or `false` if the return type is "bool".

**counter (series int/float)** The counter variable. The loop increments the variable's value from the initial value (`from_num`) to the final value (`to_num`) by a fixed amount (`step_num`) after each iteration. The last possible iteration occurs when the variable's value reaches the `to_num` value.

**from\_num (series int/float)** The value of the `counter` variable on the loop's first iteration.

**to\_num (series int/float)** The final `counter` value for which the loop's header allows a new iteration. The loop increments the `counter` value by the `step_num` until it reaches or passes this value. If the script modifies this value during a loop iteration, the loop header uses the new value to control the allowed subsequent iterations.

**step\_num (series int/float)** Optional. A positive value specifying the amount by which the `counter` value increases or decreases until it reaches or passes the `to_num` value. If the `from_num` value is greater than the initial `to_num` value, the loop subtracts this amount from the `counter` value after each iteration. Otherwise, the loop adds this amount after each iteration. The default is 1.

**statements** The code statements and expressions within the loop's body, i.e., the indented block of code beneath the loop header.

**return\_expression (any type)** The last expression or statement within the loop's body. The loop returns the results from this code after the final iteration. If the loop stops prematurely due to a `continue` or `break` statement, the returned values or references are those of the latest iteration that evaluated this code. To use the loop's returned results, assign them to a variable or tuple.

**continue** A loop-specific keyword that instructs the script to skip the remainder of the current loop iteration and continue to the next iteration.

**break** A loop-specific keyword that prompts the script to stop the current iteration and exit the loop entirely.

Example

```
//@version=6  
indicator("Basic `for` loop")  
  
//@function Calculates the number of bars in the last `length` bars that have their `close` above the current `close`.  
//@param length The number of bars used in the calculation.  
greaterCloseCount(length) =>  
    int result = 0  
    for i = 1 to length  
        if close[i] > close  
            result += 1  
    result  
  
plot(greaterCloseCount(14))
```

Example

```
//@version=6  
indicator("`for` loop with a step")  
  
a = array.from(0, 1, 2, 3, 4, 5, 6, 7, 8, 9)  
sum = 0.0  
  
for i = 0 to 9 by 5  
    // Because the step is set to 5, we are adding only the first (0) and the sixth (5) value from the array `a`.  
    sum += array.get(a, i)  
  
plot(sum)
```

Remarks

Modifying a loop's `to_num` value during an iteration does not change the direction of the loop's counter. For a loop that counts upward, setting the `to_num` to a value less than the `from_num` value on an iteration stops the loop immediately after that iteration ends. Likewise, a loop that counts downward stops after an iteration where the `to_num` value becomes greater than the `from_num` value.

If a script initializes a variable declared with [var](#kw_var) or [varip](#kw_varip) using a loop's result, the loop stops after the *first* iteration, even if the header's criteria allow more iterations. Instead of initializing the variable with the result of this structure directly, declare the variable first and use [:=](#op_:=) to update it with the result. Alternatively, move the loop into a [Declaring functions](https://www.tradingview.com/pine-script-docs/language/user-defined-functions/) and initialize the variable using a call to that function.

See the [Loops](https://www.tradingview.com/pine-script-docs/language/loops/#loops) page of our User Manual to learn more about loops and how they work.

See also

[for...in](#kw_for...in)[while](#kw_while)
