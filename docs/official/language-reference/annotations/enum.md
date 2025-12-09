### @enum

If placed above an enum declaration, it adds a custom description for the enum. The Pine Editor's autosuggest uses this description and displays it when a user hovers over the enum name. When used in library scripts, the descriptions of all enums using the [export](#kw_export) keyword will pre-fill the "Description" field in the publication dialogue.

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
