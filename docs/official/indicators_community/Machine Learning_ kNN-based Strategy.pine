// This source code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/
// © capissimo

//@version=5
indicator('Machine Learning: kNN-based Strategy', 'ML-kNN', true, max_labels_count=300, format=format.price, precision=2, timeframe="", timeframe_gaps=true)

// kNN-based Strategy (FX and Crypto)
// Description: 
// This strategy uses a classic machine learning algorithm - k Nearest Neighbours (kNN) - 
// to let you find a prediction for the next (tomorrow's, next month's, etc.) market move. 
// Being an unsupervised machine learning algorithm, kNN is one of the most simple learning algorithms. 

// To do a prediction of the next market move, the kNN algorithm uses the historic data, 
// collected in 3 arrays - feature1, feature2 and directions, - and finds the k-nearest 
// neighbours of the current indicator(s) values. 

// The two dimensional kNN algorithm just has a look on what has happened in the past when 
// the two indicators had a similar level. It then looks at the k nearest neighbours, 
// sees their state and thus classifies the current point.

// The kNN algorithm offers a framework to test all kinds of indicators easily to see if they 
// have got any *predictive value*. One can easily add cog, wpr and others.
// Note: TradingViews's playback feature helps to see this strategy in action.
// Warning: Signals ARE repainting.

// Style tags: Trend Following, Trend Analysis
// Asset class: Equities, Futures, ETFs, Currencies and Commodities
// Dataset: FX Minutes/Hours+++/Days

//-- Preset Dates

int startdate = timestamp('01 Jan 2000 00:00:00 GMT+10')
int stopdate  = timestamp('31 Dec 2025 23:45:00 GMT+10')

//-- Inputs

StartDate  = input.time  (startdate, 'Start Date')
StopDate   = input.time  (stopdate,  'Stop Date')
Indicator  = input.string('All',     'Indicator',   ['RSI','ROC','CCI','Volume','All'])
ShortWinow = input.int   (14,        'Short Period [1..n]', 1)
LongWindow = input.int   (28,        'Long Period [2..n]',  2)
BaseK      = input.int   (252,       'Base No. of Neighbours (K) [5..n]', 5)
Filter     = input.bool  (false,     'Volatility Filter')
Bars       = input.int   (300,       'Bar Threshold [2..5000]', 2, 5000)

//-- Constants

var int BUY   = 1
var int SELL  =-1
var int CLEAR = 0

var int k     = math.floor(math.sqrt(BaseK))  // k Value for kNN algo

//-- Variable

// Training data, normalized to the range of [0,...,100]
var array<float> feature1   = array.new_float(0)  // [0,...,100]
var array<float> feature2   = array.new_float(0)  //    ...
var array<int>   directions = array.new_int(0)    // [-1; +1]

// Result data
var array<int>   predictions = array.new_int(0)
var float        prediction  = 0.0
var array<int>   bars        = array.new<int>(1, 0) // array used as a container for inter-bar variables

// Signals
var int          signal      = CLEAR

//-- Functions

minimax(float x, int p, float min, float max) => 
    float hi = ta.highest(x, p), float lo = ta.lowest(x, p)
    (max - min) * (x - lo)/(hi - lo) + min

cAqua(int g) => g>9?#0080FFff:g>8?#0080FFe5:g>7?#0080FFcc:g>6?#0080FFb2:g>5?#0080FF99:g>4?#0080FF7f:g>3?#0080FF66:g>2?#0080FF4c:g>1?#0080FF33:#00C0FF19
cPink(int g) => g>9?#FF0080ff:g>8?#FF0080e5:g>7?#FF0080cc:g>6?#FF0080b2:g>5?#FF008099:g>4?#FF00807f:g>3?#FF008066:g>2?#FF00804c:g>1?#FF008033:#FF008019

inside_window(float start, float stop) =>  
    time >= start and time <= stop ? true : false

//-- Logic

bool window = inside_window(StartDate, StopDate)

// 3 pairs of predictor indicators, long and short each
float rs = ta.rsi(close,   LongWindow),        float rf = ta.rsi(close,   ShortWinow)
float cs = ta.cci(close,   LongWindow),        float cf = ta.cci(close,   ShortWinow)
float os = ta.roc(close,   LongWindow),        float of = ta.roc(close,   ShortWinow)
float vs = minimax(volume, LongWindow, 0, 99), float vf = minimax(volume, ShortWinow, 0, 99)

// TOADD or TOTRYOUT:
//    ta.cmo(close, LongWindow), ta.cmo(close, ShortWinow)
//    ta.mfi(close, LongWindow), ta.mfi(close, ShortWinow)
//    ta.mom(close, LongWindow), ta.mom(close, ShortWinow)

float f1 = switch Indicator
    'RSI'    => rs 
    'CCI'    => cs 
    'ROC'    => os 
    'Volume' => vs 
    => math.avg(rs, cs, os, vs)

float f2 = switch Indicator
    'RSI'    => rf 
    'CCI'    => cf
    'ROC'    => of
    'Volume' => vf 
    => math.avg(rf, cf, of, vf)

// Classification data, what happens on the next bar
int class_label = int(math.sign(close[1] - close[0])) // eq. close[1]<close[0] ? SELL: close[1]>close[0] ? BUY : CLEAR

// Use particular training period
if window
    // Store everything in arrays. Features represent a square 100 x 100 matrix,
    // whose row-colum intersections represent class labels, showing historic directions
    array.push(feature1, f1)
    array.push(feature2, f2)
    array.push(directions, class_label)

// Ucomment the followng statement (if barstate.islast) and tab everything below
// between BOBlock and EOBlock marks to see just the recent several signals gradually 
// showing up, rather than all the preceding signals

//if barstate.islast   

//==BOBlock	

// Core logic of the algorithm
int   size    = array.size(directions)
float maxdist = -999.0
// Loop through the training arrays, getting distances and corresponding directions.
for i=0 to size-1
    // Calculate the euclidean distance of current point to all historic points,
    // here the metric used might as well be a manhattan distance or any other.
    float d = math.sqrt(math.pow(f1 - array.get(feature1, i), 2) + math.pow(f2 - array.get(feature2, i), 2))
    
    if d > maxdist
        maxdist := d
        if array.size(predictions) >= k
            array.shift(predictions)
        array.push(predictions, array.get(directions, i))
        
//==EOBlock	

// Note: in this setup there's no need for distances array (i.e. array.push(distances, d)),
//       but the drawback is that a sudden max value may shadow all the subsequent values.
// One of the ways to bypass this is to:
// 1) store d in distances array,
// 2) calculate newdirs = bubbleSort(distances, directions), and then 
// 3) take a slice with array.slice(newdirs) from the end
    	
// Get the overall prediction of k nearest neighbours
prediction := array.sum(predictions)   

bool filter = Filter ? ta.atr(10) > ta.atr(40) : true // filter out by volatility or ex. ta.atr(1) > ta.atr(10)...

// Now that we got a prediction for the next market move, we need to make use of this prediction and 
// trade it. The returns then will show if everything works as predicted.
// Over here is a simple long/short interpretation of the prediction, 
// but of course one could also use the quality of the prediction (+5 or +1) in some sort of way,
// ex. for position sizing.

bool long  = prediction > 0 and filter
bool short = prediction < 0 and filter
bool clear = not(long and short)

if array.get(bars, 0)==Bars    // stop by trade duration
    signal := CLEAR
    array.set(bars, 0, 0)
else
    array.set(bars, 0, array.get(bars, 0) + 1)

signal := long ? BUY : short ? SELL : clear ? CLEAR : nz(signal[1])

int  changed         = ta.change(signal)
bool startLongTrade  = changed and signal==BUY 
bool startShortTrade = changed and signal==SELL 
// bool endLongTrade    = changed and signal==SELL
// bool endShortTrade   = changed and signal==BUY  
bool clear_condition = changed and signal==CLEAR //or (changed and signal==SELL) or (changed and signal==BUY)

float maxpos = ta.highest(high, 10)
float minpos = ta.lowest (low,  10)

//-- Visuals

plotshape(startLongTrade  ? minpos : na, 'Buy',      shape.labelup,   location.belowbar, cAqua(int(prediction*5)),  size=size.small)  // color intensity correction
plotshape(startShortTrade ? maxpos : na, 'Sell',     shape.labeldown, location.abovebar, cPink(int(-prediction*5)), size=size.small)
// plot(endLongTrade         ? ohlc4  : na, 'StopBuy',  cAqua(6), 3, plot.style_cross)
// plot(endShortTrade        ? ohlc4  : na, 'StopSell', cPink(6), 3, plot.style_cross)
plot(clear_condition      ? close  : na, 'ClearPos', color.yellow, 4, plot.style_cross)


//-- Notification

// if changed and signal==BUY 
//     alert('Buy Alert', alert.freq_once_per_bar)  // alert.freq_once_per_bar_close
// if changed and signal==SELL 
//     alert('Sell Alert', alert.freq_once_per_bar)

alertcondition(startLongTrade,  'Buy',  'Go long!')
alertcondition(startShortTrade, 'Sell', 'Go short!') 
//alertcondition(startLongTrade or startShortTrade, 'Alert', 'Deal Time!')

//-------------------- Backtesting (TODO)

// show_cumtr = input.bool (false, 'Show Trade Return?')
// lot_size   = input.float(100.0, 'Lot Size', [0.1,0.2,0.3,0.5,1,2,3,5,10,20,30,50,100,1000,2000,3000,5000,10000]) 

// var start_lt     = 0.  
// var long_trades  = 0.
// var start_st     = 0.  
// var short_trades = 0.

// if startLongTrade 
//     start_lt := ohlc4 
// if endLongTrade
//     long_trades := (open - start_lt) * lot_size  
// if startShortTrade 
//     start_st := ohlc4 
// if endShortTrade
//     short_trades := (start_st - open) * lot_size 
    
// cumreturn = ta.cum(long_trades) + ta.cum(short_trades) 
    
// var label lbl = na
// if show_cumtr //and barstate.islast  
//     lbl := label.new(bar_index+10, close, 'CumReturn: ' + str.tostring(cumreturn, '#.#'), xloc.bar_index, yloc.price, 
//                      color.new(color.blue, 100), label.style_label_left, color.black, size.small, text.align_left)
//     label.delete(lbl[1])
