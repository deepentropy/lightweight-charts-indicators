### earnings.future\_revenue

Returns the estimated Revenue of the next earnings report in the currency of the instrument, or [na](#var_na) if this data isn't available.

Type

series float

Remarks

This value is only fetched once during the script's initial calculation. The variable will return the same value until the script is recalculated, even after the expected time of the next earnings report.

See also

[request.earnings](#fun_request.earnings)
