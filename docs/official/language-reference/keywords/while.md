### while

Creates a condition-controlled loop whose local code block executes repeatedly while the value of a conditional expression remains `true`. The loop's iterations end after the condition's value becomes `false`.

Syntax

```
[variables = | :=] while condition
    statements | continue | break
    return_expression
```

**variables (return\_expression type)** - Optional. A variable or tuple to hold the values or references from the last evaluation of `return_expression` after the loop terminates. The script can assign the loop's returned results to variables only if the results are not of the "void" type. If the loop's conditions prevent iteration, or if no iterations evaluate `return_expression`, the variables' assigned values or references are [na](#var_na), or `false` if the return type is "bool".

**condition (series bool)** - The conditional expression that controls the loop's iterations. If `true`, the script performs a new iteration. If `false`, the script exits the loop without performing a new iteration.

**statements** - The code statements and expressions within the loop's body, i.e., the indented block of code beneath the loop header.

**return\_expression (any type)** - The last expression or statement within the loop's body. The loop returns the results from this code after the final iteration. If the loop stops prematurely due to a `continue` or `break` statement, the returned values or references are those of the latest iteration that evaluated this code. To use the loop's returned results, assign them to a variable or tuple.

**continue** - A loop-specific keyword that instructs the script to skip the remainder of the current loop iteration and continue to the next iteration.

**break** - A loop-specific keyword that prompts the script to stop the current iteration and exit the loop entirely.

Example

```
//@version=6  
indicator("`while` demo")  
  
//@variable The number for which to calculate the factorial (N!).  
//          The factorial is the product of all integers from 1 to `n`, with the exception (0! == 1).  
int n = input.int(10, "N", 0)  
  
//@variable The current value to multiply in the factorial calculation.   
var int counter = n  
//@variable The factorial value.  
var int factorial = 1  
  
if barstate.isfirst  
    // Repeatedly multiply `factorial` by `counter` and decrease the `counter` value by 1.  
    // The loop ends after the value of `counter` becomes 0.    
    while counter > 0  
        factorial *= counter  
        counter   -= 1  
  
plot(factorial, "N!")
```

Remarks

If a script initializes a variable declared with [var](#kw_var) or [varip](#kw_varip) using a loop's result, the loop stops after the *first* iteration, even if the header's criteria allow more iterations. Instead of initializing the variable with the result of this structure directly, declare the variable first and use [:=](#op_:=) to update it with the result. Alternatively, move the loop into a [Declaring functions](https://www.tradingview.com/pine-script-docs/language/user-defined-functions/) and initialize the variable using a call to that function.

See the [Loops](https://www.tradingview.com/pine-script-docs/language/loops/#loops) page of our User Manual to learn more about loops and how they work.
