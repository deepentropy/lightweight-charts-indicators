### barstate.isconfirmed

Returns true if the script is calculating the last (closing) update of the current bar. The next script calculation will be on the new bar data.

Type

series bool

Remarks

Pine Script® code that uses this variable could calculate differently on history and real-time data.

It is NOT recommended to use [barstate.isconfirmed](#var_barstate.isconfirmed) in [request.security](#fun_request.security) expression. Its value requested from [request.security](#fun_request.security) is unpredictable.

See also

[barstate.isfirst](#var_barstate.isfirst)[barstate.islast](#var_barstate.islast)[barstate.ishistory](#var_barstate.ishistory)[barstate.isrealtime](#var_barstate.isrealtime)[barstate.isnew](#var_barstate.isnew)[barstate.islastconfirmedhistory](#var_barstate.islastconfirmedhistory)
