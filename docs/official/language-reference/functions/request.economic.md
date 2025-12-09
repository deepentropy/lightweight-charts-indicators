### request.economic()

Requests economic data for a symbol. Economic data includes information such as the state of a country's economy (GDP, inflation rate, etc.) or of a particular industry (steel production, ICU beds, etc.).

Syntax

```
request.economic(country_code, field, gaps, ignore_invalid_symbol) → series float
```

Arguments

country\_code (series string) The code of the country (e.g. "US") or the region (e.g. "EU") for which the economic data is requested. The [Help Center article](https://www.tradingview.com/chart/?solution=43000665359) lists the countries and their codes. The countries for which information is available vary with metrics. The [Help Center article for each metric](https://www.tradingview.com/support/folders/43000581956-list-of-available-economic-indicators/) lists the countries for which the metric is available.

field (series string) The code of the requested economic metric (e.g., "GDP"). The [Help Center article](https://www.tradingview.com/chart/?solution=43000665359) lists the metrics and their codes.

gaps (simple barmerge\_gaps) Specifies how the returned values are merged on chart bars. Possible values: [barmerge.gaps\_off](#const_barmerge.gaps_off), [barmerge.gaps\_on](#const_barmerge.gaps_on). With [barmerge.gaps\_on](#const_barmerge.gaps_on), a value only appears on the current chart bar when it first becomes available from the function's context, otherwise [na](#var_na) is returned (thus a "gap" occurs). With [barmerge.gaps\_off](#const_barmerge.gaps_off), what would otherwise be gaps are filled with the latest known value returned, avoiding [na](#var_na) values. Optional. The default is [barmerge.gaps\_off](#const_barmerge.gaps_off).

ignore\_invalid\_symbol (input bool) Determines the behavior of the function if the specified symbol is not found: if [false](#const_false), the script will halt and return a runtime error; if [true](#const_true), the function will return [na](#var_na) and execution will continue. Optional. The default is [false](#const_false).

Example

```
//@version=6  
indicator("US GDP")  
e = request.economic("US", "GDP")  
plot(e)
```

Returns

Requested series.

Remarks

Economic data can also be accessed from charts, just like a regular symbol. Use "ECONOMIC" as the exchange name and `{country_code}{field}` as the ticker. The name of US GDP data is thus "ECONOMIC:USGDP".

See also

[request.financial](#fun_request.financial)
