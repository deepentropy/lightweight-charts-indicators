### dividends.future\_amount

Returns the payment amount of the upcoming dividend in the currency of the current instrument, or [na](#var_na) if this data isn't available.

Type

series float

Remarks

This value is only fetched once during the script's initial calculation. The variable will return the same value until the script is recalculated, even after the expected Payment date of the next dividend.
