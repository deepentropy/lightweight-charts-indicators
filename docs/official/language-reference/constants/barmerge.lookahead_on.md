### barmerge.lookahead\_on

Merge strategy for the requested data position. Requested barset is merged with current barset in the order of sorting bars by their opening time. This merge strategy can lead to undesirable effect of getting data from "future" on calculation on history. This is unacceptable in backtesting strategies, but can be useful in indicators.

Type

const barmerge\_lookahead

See also

[request.security](#fun_request.security)[barmerge.lookahead\_off](#const_barmerge.lookahead_off)
