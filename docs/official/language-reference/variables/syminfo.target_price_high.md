### syminfo.target\_price\_high

The last highest yearly price target for the symbol predicted by analysts.

Type

series float

Example

```
//@version=6  
indicator("syminfo target_price")  
if barstate.islastconfirmedhistory  
    //@variable The time value one year from the date of the last analyst recommendations.  
    int YTD = syminfo.target_price_date + timeframe.in_seconds("12M") * 1000  
    //@variable A line connecting the current `close` to the highest yearly price estimate.  
    highLine = line.new(time, close, YTD, syminfo.target_price_high, color = color.green, xloc = xloc.bar_time)  
    //@variable A line connecting the current `close` to the lowest yearly price estimate.  
    lowLine = line.new(time, close, YTD, syminfo.target_price_low, color = color.red, xloc = xloc.bar_time)  
    //@variable A line connecting the current `close` to the median yearly price estimate.  
    medianLine = line.new(time, close, YTD, syminfo.target_price_median, color = color.gray, xloc = xloc.bar_time)  
    //@variable A line connecting the current `close` to the average yearly price estimate.  
    averageLine = line.new(time, close, YTD, syminfo.target_price_average, color = color.orange, xloc = xloc.bar_time)  
    // Fill the space between targets  
    linefill.new(lowLine, medianLine, color.new(color.red, 90))  
    linefill.new(medianLine, highLine, color.new(color.green, 90))  
    // Create a label displaying the total number of analyst estimates.  
    string estimatesText = str.format("Number of estimates: {0}", syminfo.target_price_estimates)  
    label.new(bar_index, close, estimatesText, textcolor = color.white, size = size.large)
```

Remarks

If analysts supply the targets when the market is closed, the variable can return [na](#var_na) until the market opens.

See also

[syminfo.target\_price\_average](#var_syminfo.target_price_average)[syminfo.target\_price\_date](#var_syminfo.target_price_date)[syminfo.target\_price\_estimates](#var_syminfo.target_price_estimates)[syminfo.target\_price\_low](#var_syminfo.target_price_low)[syminfo.target\_price\_median](#var_syminfo.target_price_median)
