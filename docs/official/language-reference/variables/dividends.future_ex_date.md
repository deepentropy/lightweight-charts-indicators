### dividends.future\_ex\_date

Returns the Ex-dividend date (Ex-date) of the current instrument's next dividend payment, or [na](#var_na) if this data isn't available. Ex-dividend date signifies when investors are no longer entitled to a payout from the most recent dividend. Only those who purchased shares before this day are entitled to the dividend payment.

Type

series int

Returns

UNIX time, expressed in milliseconds.

Remarks

This value is only fetched once during the script's initial calculation. The variable will return the same value until the script is recalculated, even after the expected Payment date of the next dividend.
