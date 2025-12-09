### request.quandl()

**Note:** This function has been deprecated due to the API change from NASDAQ Data Link. Requests for "QUANDL" symbols are no longer valid and requests for them return a runtime error.

Some of the data previously provided by this function is available on TradingView through other feeds, such as "BCHAIN" or "FRED". Use Symbol Search to look for such data based on its description. Commitment of Traders (COT) data can be requested using the official [LibraryCOT](https://www.tradingview.com/v/ysFf2OTq/) library.

Requests [Nasdaq Data Link](https://data.nasdaq.com/) (formerly Quandl) data for a symbol.

Syntax

```
request.quandl(ticker, gaps, index, ignore_invalid_symbol) → series float
```

Arguments

ticker (series string) Symbol. Note that the name of a time series and Quandl data feed should be divided by a forward slash. For example: "CFTC/SB\_FO\_ALL".

gaps (simple barmerge\_gaps) Merge strategy for the requested data (requested data automatically merges with the main series: OHLC data). Possible values include: [barmerge.gaps\_on](#const_barmerge.gaps_on), [barmerge.gaps\_off](#const_barmerge.gaps_off). [barmerge.gaps\_on](#const_barmerge.gaps_on) - requested data is merged with possible gaps ([na](#var_na) values). [barmerge.gaps\_off](#const_barmerge.gaps_off) - requested data is merged continuously without gaps, all the gaps are filled with the previous, nearest existing values. Default value is [barmerge.gaps\_off](#const_barmerge.gaps_off).

index (series int) A Quandl time-series column index.

ignore\_invalid\_symbol (input bool) An optional parameter. Determines the behavior of the function if the specified symbol is not found: if false, the script will halt and return a runtime error; if true, the function will return na and execution will continue. The default value is false.

Example

```
//@version=6  
indicator("request.quandl")  
f = request.quandl("CFTC/SB_FO_ALL", barmerge.gaps_off, 0)  
plot(f)
```

Returns

Requested series.

See also

[request.security](#fun_request.security)[syminfo.tickerid](#var_syminfo.tickerid)
