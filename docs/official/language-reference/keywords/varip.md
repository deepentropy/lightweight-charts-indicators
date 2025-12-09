### varip

**varip** (var intrabar persist) is the keyword used for the assignment and one-time initialization of a variable or a field of a user-defined [type](#kw_type). It’s similar to the [var](#kw_var) keyword, but variables and fields declared with [varip](#kw_varip) retain their values between executions of the script on the same bar.

Syntax

```
varip [<variable_type> ]<variable_name> = <expression>

[export ]type <UDT_identifier>
    varip <field_type> <field_name> [= <value>]
```

where:

**variable\_type** - An optional fundamental type ([int](#type_int), [float](#type_float), [bool](#type_bool), [color](#type_color), [string](#type_string)) or a user-defined type, or an array or matrix of one of those types. Special types are not compatible with this keyword.

**variable\_name** - A [valid identifier](https://www.tradingview.com/pine-script-docs/language/identifiers/). The variable can also be an object created from a UDT.

**expression** - Any arithmetic expression, just as when defining a regular variable. The expression will be calculated and assigned to the variable only once, on the first bar.

**UDT\_identifier, field\_type, field\_name, value** - Constructs related to user-defined types as described in the [type](#kw_type) section.

Example

```
//@version=6  
indicator("varip")  
varip int v = -1  
v := v + 1  
plot(v)
```

With [var](#kw_var), `v` would equal the value of the [bar\_index](#var_bar_index). On historical bars, where the script calculates only once per chart bar, the value of `v` is the same as with [var](#kw_var). However, on realtime bars, the script will evaluate the expression on each new chart update, producing a different result.

Example

```
//@version=6  
indicator("varip with types")  
type barData  
    int index = -1  
    varip int ticks = -1  
  
var currBar = barData.new()  
currBar.index += 1  
currBar.ticks += 1  
  
// Will be equal to bar_index on all bars  
plot(currBar.index)  
// In real time, will increment per every tick on the chart  
plot(currBar.ticks)
```

The same [+=](#op_+=) operation applied to both the `index` and `ticks` fields results in different real-time values because `ticks` increases on every chart update, while `index` only does so once per bar. Note how the `currBar` object does not use the [varip](#kw_varip) keyword. The `ticks` field of the object can increment on every tick, but the reference itself is defined once and then stays unchanged. If we were to declare `currBar` using [varip](#kw_varip), the behavior of `index` would remain unchanged because while the reference to the type instance would persist between chart updates, the `index` field of the object would not.

Remarks

When using [varip](#kw_varip) to declare variables in strategies that may execute more than once per historical chart bar, the values of such variables are preserved across successive iterations of the script on the same bar.

The effect of [varip](#kw_varip) eliminates the [rollback](https://www.tradingview.com/pine-script-docs/language/execution-model/#calculation-based-on-realtime-bars) of variables before each successive execution of a script on the same bar.
