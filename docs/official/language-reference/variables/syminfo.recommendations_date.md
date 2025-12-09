### syminfo.recommendations\_date

The starting date of the last set of recommendations for the current symbol.

Type

series int

Example

```
//@version=6  
indicator("syminfo recommendations", overlay = true)  
//@variable A table containing information about analyst recommendations.  
var table ratings = table.new(position.top_right, 8, 2, frame_color = #000000)  
if barstate.islastconfirmedhistory  
    //@variable The time value one year from the date of the last analyst recommendations.  
    int YTD = syminfo.target_price_date + timeframe.in_seconds("12M") * 1000  
    // Add header cells.  
    table.cell(ratings, 0, 0, "Start Date", bgcolor = color.gray, text_color = #000000, text_size = size.large)  
    table.cell(ratings, 1, 0, "End Date", bgcolor = color.gray, text_color = #000000, text_size = size.large)  
    table.cell(ratings, 2, 0, "Buy", bgcolor = color.teal, text_color = #000000, text_size = size.large)  
    table.cell(ratings, 3, 0, "Strong Buy", bgcolor = color.lime, text_color = #000000, text_size = size.large)  
    table.cell(ratings, 4, 0, "Sell", bgcolor = color.maroon, text_color = #000000, text_size = size.large)  
    table.cell(ratings, 5, 0, "Strong Sell", bgcolor = color.red, text_color = #000000, text_size = size.large)  
    table.cell(ratings, 6, 0, "Hold", bgcolor = color.orange, text_color = #000000, text_size = size.large)  
    table.cell(ratings, 7, 0, "Total", bgcolor = color.silver, text_color = #000000, text_size = size.large)  
    // Recommendation strings  
    string startDate         = str.format_time(syminfo.recommendations_date, "yyyy-MM-dd")  
    string endDate           = str.format_time(YTD, "yyyy-MM-dd")  
    string buyRatings        = str.tostring(syminfo.recommendations_buy)  
    string strongBuyRatings  = str.tostring(syminfo.recommendations_buy_strong)  
    string sellRatings       = str.tostring(syminfo.recommendations_sell)  
    string strongSellRatings = str.tostring(syminfo.recommendations_sell_strong)  
    string holdRatings       = str.tostring(syminfo.recommendations_hold)  
    string totalRatings      = str.tostring(syminfo.recommendations_total)  
    // Add value cells  
    table.cell(ratings, 0, 1, startDate, bgcolor = color.gray, text_color = #000000, text_size = size.large)  
    table.cell(ratings, 1, 1, endDate, bgcolor = color.gray, text_color = #000000, text_size = size.large)  
    table.cell(ratings, 2, 1, buyRatings, bgcolor = color.teal, text_color = #000000, text_size = size.large)  
    table.cell(ratings, 3, 1, strongBuyRatings, bgcolor = color.lime, text_color = #000000, text_size = size.large)  
    table.cell(ratings, 4, 1, sellRatings, bgcolor = color.maroon, text_color = #000000, text_size = size.large)
```

See also

[syminfo.recommendations\_buy](#var_syminfo.recommendations_buy)[syminfo.recommendations\_buy\_strong](#var_syminfo.recommendations_buy_strong)[syminfo.recommendations\_hold](#var_syminfo.recommendations_hold)[syminfo.recommendations\_total](#var_syminfo.recommendations_total)[syminfo.recommendations\_sell](#var_syminfo.recommendations_sell)[syminfo.recommendations\_sell\_strong](#var_syminfo.recommendations_sell_strong)
