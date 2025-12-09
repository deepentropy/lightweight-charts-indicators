### enum

This keyword allows the creation of an enumeration, enum for short. Enums are unique constructs that hold groups of predefined constants.

Each field in an enum has a `const string` title. Scripts can access the fields in an enum using dot notation, similar to accessing the fields of a user-defined type.

Each field represents a value of the `enumName` enum. Scripts can declare each field in an `enum` with an optional `const string` title. If a field's title is not specified, its title is the string representation of its name. Use [str.tostring](#fun_str.tostring) on an enum field to retrieve its title.

Syntax

```
[export ]enum <enumName> 
<field_1> [= <title_1>] 
<field_2> [= <title_2>] 
... 
<field_N> [= <title_N>]
```

One can use an enum to quickly create a dropdown input with the help of the [input.enum](#fun_input.enum) function. The options that appear in the dropdown represent the titles of the enum fields.

Example

```
//@version=6  
indicator("Session highlight", overlay = true)  
  
//@enum       Contains fields with popular timezones as titles.  
//@field exch Has an empty string as the title to represent the chart timezone.  
enum tz  
    utc  = "UTC"  
    exch = ""  
    ny   = "America/New_York"  
    chi  = "America/Chicago"  
    lon  = "Europe/London"  
    tok  = "Asia/Tokyo"  
  
//@variable The session string.  
selectedSession = input.session("1200-1500", "Session")  
//@variable The selected timezone. The input's dropdown contains the fields in the `tz` enum.  
selectedTimezone = input.enum(tz.utc, "Session Timezone")  
  
//@variable Is `true` if the current bar's time is in the specified session.  
bool inSession = false  
if not na(time("", selectedSession, str.tostring(selectedTimezone)))  
    inSession := true  
  
// Highlight the background when `inSession` is `true`.  
bgcolor(inSession ? color.new(color.green, 90) : na, title = "Active session highlight")
```

Additionally, one can use an enum in a collection's type template to restrict the values it will allow as elements. When used inside a type template, the collection will only accept fields that belong to the specified enum.

Example

```
//@version=6  
indicator("Map with enum keys")  
  
//@enum        Contains fields with titles representing ticker IDs.  
//@field aapl  Has an Apple ticker ID as its title.  
//@field tsla  Has a Tesla ticker ID as its title.  
//@field amzn  Has an Amazon ticker ID as its title.  
enum symbols  
    aapl = "NASDAQ:AAPL"  
    tsla = "NASDAQ:TSLA"  
    amzn = "NASDAQ:AMZN"  
  
//@variable A map that accepts fields from the `symbols` enum as keys and "float" values.  
map<symbols, float> data = map.new<symbols, float>()  
// Put key-value pairs into the `data` map.  
data.put(symbols.aapl, request.security(str.tostring(symbols.aapl), timeframe.period, close))  
data.put(symbols.tsla, request.security(str.tostring(symbols.tsla), timeframe.period, close))  
data.put(symbols.amzn, request.security(str.tostring(symbols.amzn), timeframe.period, close))  
// Plot the value from the `data` map accessed by the `symbols.aapl` key.  
plot(data.get(symbols.aapl))
```
