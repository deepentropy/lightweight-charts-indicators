### ta.hma()

The hma function returns the Hull Moving Average.

Syntax

```
ta.hma(source, length) → series float
```

Arguments

source (series int/float) Series of values to process.

length (simple int) Number of bars.

Example

```
//@version=6  
indicator("Hull Moving Average")  
src = input(defval=close, title="Source")  
length = input(defval=9, title="Length")  
hmaBuildIn = ta.hma(src, length)  
plot(hmaBuildIn, title="Hull MA", color=#674EA7)
```

Returns

Hull moving average of 'source' for 'length' bars back.

Remarks

`na` values in the `source` series are ignored.

See also

[ta.ema](#fun_ta.ema)[ta.rma](#fun_ta.rma)[ta.wma](#fun_ta.wma)[ta.vwma](#fun_ta.vwma)[ta.sma](#fun_ta.sma)
