### ta.dmi()

The dmi function returns the directional movement index.

Syntax

```
ta.dmi(diLength, adxSmoothing) → [series float, series float, series float]
```

Arguments

diLength (simple int) DI Period.

adxSmoothing (simple int) ADX Smoothing Period.

Example

```
//@version=6  
indicator(title="Directional Movement Index", shorttitle="DMI", format=format.price, precision=4)  
len = input.int(17, minval=1, title="DI Length")  
lensig = input.int(14, title="ADX Smoothing", minval=1)  
[diplus, diminus, adx] = ta.dmi(len, lensig)  
plot(adx, color=color.red, title="ADX")  
plot(diplus, color=color.blue, title="+DI")  
plot(diminus, color=color.orange, title="-DI")
```

Returns

[Tuple](https://www.tradingview.com/pine-script-docs/language/type-system/#tuples) of three DMI series: Positive Directional Movement (+DI), Negative Directional Movement (-DI) and Average Directional Movement Index (ADX).

See also

[ta.rsi](#fun_ta.rsi)[ta.tsi](#fun_ta.tsi)[ta.mfi](#fun_ta.mfi)
