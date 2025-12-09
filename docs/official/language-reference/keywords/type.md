### type

This keyword allows the declaration of user-defined types (UDT) from which scripts can instantiate objects. UDTs are composite types that contain an arbitrary number of fields of any built-in or user-defined type, including the defined UDT itself. The syntax to define a UDT is:

Syntax

```
[export ]type <UDT_identifier>
    [varip ]<field_type> <field_name> [= <value>]
    …
```

Once a UDT is defined, scripts can instantiate objects from it with the `UDT_identifier.new()` construct. When creating a new type instance, the fields of the resulting object will initialize with the default values from the UDT's definition. Any type fields without specified defaults will initialize as [na](#var_na). Alternatively, users can pass initial values as arguments in the `*.new()` method to override the type's defaults. For example, `newFooObject = foo.new(x = true)` assigns a new `foo` object to the `newFooObject` variable with its `x` field initialized using a value of [true](#const_true).

Field declarations can include the [varip](#kw_varip) keyword, in which case the field values persist between successive script iterations on the same bar.

For more information see the User Manual's sections on [defining UDTs](https://www.tradingview.com/pine-script-docs/language/type-system#user-defined-types) and [using objects](https://www.tradingview.com/pine-script-docs/language/objects/).

Libraries can export UDTs. See the [Libraries](https://www.tradingview.com/pine-script-docs/concepts/libraries/#user-defined-types-and-objects) page of our User Manual to learn more.

Example

```
//@version=6  
indicator("Multi Time Period Chart", overlay = true)  
  
timeframeInput = input.timeframe("1D")  
  
type bar  
    float o = open  
    float h = high  
    float l = low  
    float c = close  
    int   t = time  
  
drawBox(bar b, right) =>  
    color boxColor = b.c >= b.o ? color.green : color.red  
    box.new(b.t, b.h, right, b.l, boxColor, xloc = xloc.bar_time, bgcolor = color.new(boxColor, 90))  
  
updateBox(box boxId, bar b) =>  
    color boxColor = b.c >= b.o ? color.green : color.red  
    box.set_border_color(boxId, boxColor)  
    box.set_bgcolor(boxId, color.new(boxColor, 90))  
    box.set_top(boxId, b.h)  
    box.set_bottom(boxId, b.l)  
    box.set_right(boxId, time)  
  
secBar = request.security(syminfo.tickerid, timeframeInput, bar.new())  
  
if not na(secBar)  
    // To avoid a runtime error, only process data when an object exists.  
    if not barstate.islast  
        if timeframe.change(timeframeInput)  
            // On historical bars, draw a new box in the past when the HTF closes.  
            drawBox(secBar, time[1])  
    else  
        var box lastBox = na  
        if na(lastBox) or timeframe.change(timeframeInput)  
            // On the last bar, only draw a new current box the first time we get there or when HTF changes.  
            lastBox := drawBox(secBar, time)  
        else  
            // On other chart updates, use setters to modify the current box.  
            updateBox(lastBox, secBar)
```
