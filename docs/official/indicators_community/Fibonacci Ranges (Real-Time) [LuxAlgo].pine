// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator("Fibonacci Ranges (Real-Time) [LuxAlgo]", shorttitle='LuxAlgo - Fibonacci Ranges (Real-Time)', max_lines_count=500, max_labels_count=500, overlay=true)

//------------------------------------------------------------------------------
//Settings
//-----------------------------------------------------------------------------{
z  = '       '
y  = '          '
x  = '             '
L  = input.int   (       5       ,              'L'              , minval =1                                       , group =       'Swing Settings'         ) 
R  = input.int   (       1       ,              'R'              , minval =1                                       , group =       'Swing Settings'         )
c_ = input.string(     'Channel + Shadows'    ,           'Channel'           , options=['Channel', 'Channel + Shadows', 'None'], group =      'Fibonacci Channel'       )
opt= input.string('0.000 - 1.000',         'Break level'         ,                                                   group =      'Fibonacci Channel'       
   ,                                                               options=    ['-0.382 - 1.382', '0.000 - 1.000', '0.236 - 0.764', '0.382 - 0.618']        )
c  = input.int   (       2       ,         'Break count'         , minval =0                                       , group =      'Fibonacci Channel'       )
sb = input.bool  (     true     , z+x+     'Show breaks'                                                          , group =      'Fibonacci Channel'       )
sF = input.bool  (      false     , z+y+  'Latest Fibonacci'      ,                                                   group =      'Fibonacci'               )
F0 = input.color (  #08998164  ,            '      '           , inline='f'                                      , group =      'Fibonacci'               )
F_ = input.color (  #08998180  ,               ''              , inline='f'                                      , group =      'Fibonacci'               )
Fm = input.color (  #1e42b070  ,               ''              , inline='f'                                      , group =      'Fibonacci'               )
Fp = input.color (  #f2364580  ,               ''              , inline='f'                                      , group =      'Fibonacci'               )
F1 = input.color (  #f2364564  ,               ''              , inline='f'                                      , group =      'Fibonacci'               )

Fc = c_ != 'None' ? true : false 
fl = c_ == 'Channel + Shadows' ? true : false

n  = bar_index 

//-----------------------------------------------------------------------------}
//User Defined Types
//-----------------------------------------------------------------------------{
type piv 
    int   b 
    float p
    int   d 

type fib 
    line n0_382
    line _0_000
    line _0_236
    line _0_382
    line _0_500
    line _0_618    
    line _0_764
    line _1_000
    line _1_382   
    line diagon 
    label lab1
    label lab2
    bool active
    int  count

type fibLast
    linefill lf_0
    linefill lfM0    
    linefill lfM1
    linefill lf_1
    line     ln_0_5 
    line     diagon
    label    lab

//-----------------------------------------------------------------------------}
//Variables
//-----------------------------------------------------------------------------{
var piv[] pivs = array.new<piv>() 

var f    = fib .new (
  n0_382 = line.new (na, na, na, na, color=F0),
  _0_000 = line.new (na, na, na, na, color=F0),  
  _0_236 = line.new (na, na, na, na, color=F_),
  _0_382 = line.new (na, na, na, na, color=F_),
  _0_500 = line.new (na, na, na, na, color=Fm),
  _0_618 = line.new (na, na, na, na, color=Fp),
  _0_764 = line.new (na, na, na, na, color=Fp),
  _1_000 = line.new (na, na, na, na, color=F1),
  _1_382 = line.new (na, na, na, na, color=F1),
  lab1   = label.new(na, na    , color=color.gray
   ,style=                 label.style_label_center
   , yloc= yloc.price          ,  size=   size.tiny),
  lab2   = label.new(na, na    , color=color.gray
   ,style=                 label.style_label_center
   , yloc= yloc.price          ,  size=   size.tiny),
  diagon = line.new (na, na, na, na
   ,color=color.silver   ,style=line.style_dashed),
  active = false, count = 0
 )

var fibLast fLast  = fibLast.new(
   lf_0 = linefill.new( 
       line       .new(na, na, na, na, color=F0)
     , line       .new(na, na, na, na, color=F0)
     , color      .new(F0, 75)
     ),
   lfM0 = linefill.new( 
       line       .new(na, na, na, na, color=F_)
     , line       .new(na, na, na, na, color=F_)
     , color      .new(F_, 75)
     ),
   lfM1 = linefill.new( 
       line       .new(na, na, na, na, color=Fp)
     , line       .new(na, na, na, na, color=Fp)
     , color      .new(Fp, 75)
     ),
   lf_1 = linefill.new( 
       line       .new(na, na, na, na, color=F1)
     , line       .new(na, na, na, na, color=F1)
     , color      .new(F1, 75)
     ),     
   ln_0_5  = line.new(na, na, na, na, color=color.blue     ),
   diagon  = line.new(na, na, na, na, color=color.silver  
           ,                          style=line.style_dashed),
   lab     = label.new(   na, na    , color=color.gray     )
   )

var line ln = line.new(na, na, na, na)
bool brokeU = false
bool brokeD = false

//-----------------------------------------------------------------------------}
//Execution
//-----------------------------------------------------------------------------{
ph = ta.pivothigh(L, R)
pl = ta.pivotlow (L, R)

a1 = switch opt 
    '-0.382 - 1.382' => -0.382
    '0.000 - 1.000'  =>  0
    '0.236 - 0.764'  =>  0.236
    '0.382 - 0.618'  =>  0.382

a2 = switch opt 
    '-0.382 - 1.382' =>  1.382
    '0.000 - 1.000'  =>  1
    '0.236 - 0.764'  =>  0.764
    '0.382 - 0.618'  =>  0.618

if ph
    if pivs.size() > 0 
        get = pivs.first() 
        if get.d > 0 and ph > get.p
            get.b :=  n  -R
            get.p := high[R]
        if get.d < 0 and ph > get.p
            pivs.unshift(piv.new(n -R, high[R] , 1))
    else 
        pivs    .unshift(piv.new(n -R, high[R] , 1))
    
    if pivs.size() > 1 and not f.active and Fc
        get1 = pivs.get(1)   , idx1    = get1.b         , diff                  = high[R] -  get1.p
        f.n0_382.set_xy1(n -R, high[R] + (diff * 0.382)), f.n0_382.set_xy2(n + 8, high[R] + (diff * 0.382))
        f._0_000.set_xy1(n -R, high[R]                 ), f._0_000.set_xy2(n + 8, high[R]                 )
        f._0_236.set_xy1(n -R, high[R] - (diff * 0.236)), f._0_236.set_xy2(n + 8, high[R] - (diff * 0.236))
        f._0_382.set_xy1(n -R, high[R] - (diff * 0.382)), f._0_382.set_xy2(n + 8, high[R] - (diff * 0.382))
        f._0_500.set_xy1(n -R, high[R] - (diff * 0.500)), f._0_500.set_xy2(n + 8, high[R] - (diff * 0.500))
        f._0_618.set_xy1(n -R, high[R] - (diff * 0.618)), f._0_618.set_xy2(n + 8, high[R] - (diff * 0.618))        
        f._0_764.set_xy1(n -R, high[R] - (diff * 0.764)), f._0_764.set_xy2(n + 8, high[R] - (diff * 0.764))
        f._1_000.set_xy1(n -R,            get1.p       ), f._1_000.set_xy2(n + 8,            get1.p       )
        f._1_382.set_xy1(n -R, get1.p  - (diff * 0.382)), f._1_382.set_xy2(n + 8, get1.p  - (diff * 0.382))
        f.lab1  .set_xy (n +8, high[R] - (diff *   a1 )), f.lab2  .set_xy (n + 8, high[R] - (diff *   a2 ))
        f.diagon.set_xy1(idx1, get1.p                  ), f.diagon.set_xy2(n  -R, high[R]                 )
        f.active := true 
           
if pl
    if pivs.size() > 0 
        get = pivs.first() 
        if get.d < 0 and pl < get.p
            get.b :=  n  -R
            get.p := low [R]            
        if get.d > 0 and pl < get.p
            pivs.unshift(piv.new(n -R, low [R] ,-1))            
    else
        pivs    .unshift(piv.new(n -R, low [R] ,-1))
        
    if pivs.size() > 1 and not f.active and Fc
        get1 = pivs.get(1)   , idx1    = get1.b         , diff    =   get1.p -    low [R] 
        f.n0_382.set_xy1(n -R, low [R] - (diff * 0.382)), f.n0_382.set_xy2(n + 8, low [R] - (diff * 0.382))
        f._0_000.set_xy1(n -R, low [R]                 ), f._0_000.set_xy2(n + 8, low [R]                 )        
        f._0_236.set_xy1(n -R, low [R] + (diff * 0.236)), f._0_236.set_xy2(n + 8, low [R] + (diff * 0.236))
        f._0_382.set_xy1(n -R, low [R] + (diff * 0.382)), f._0_382.set_xy2(n + 8, low [R] + (diff * 0.382))
        f._0_500.set_xy1(n -R, low [R] + (diff * 0.500)), f._0_500.set_xy2(n + 8, low [R] + (diff * 0.500))
        f._0_618.set_xy1(n -R, low [R] + (diff * 0.618)), f._0_618.set_xy2(n + 8, low [R] + (diff * 0.618))        
        f._0_764.set_xy1(n -R, low [R] + (diff * 0.764)), f._0_764.set_xy2(n + 8, low [R] + (diff * 0.764))
        f._1_000.set_xy1(n -R,            get1.p       ), f._1_000.set_xy2(n + 8,            get1.p       )
        f._1_382.set_xy1(n -R, get1.p  + (diff * 0.382)), f._1_382.set_xy2(n + 8, get1.p  + (diff * 0.382))
        f.lab1  .set_xy (n +8, low [R] + (diff *   a1 )), f.lab2  .set_xy (n + 8, low [R] + (diff *   a2 ))
        f.diagon.set_xy1(idx1, get1.p                  ), f.diagon.set_xy2(n  -R, low [R]                 )
        f.active := true 

if pivs.size() >= 2    
    max         =                      math.max(pivs.first().p, pivs.get(1).p )
    min         =                      math.min(pivs.first().p, pivs.get(1).p )
    dif         =                                         max - min 
    _0i         =                      pivs.first( ).b, _0p   = pivs.first( ).p
    _1i         =                      pivs.get  (1).b, _1p   = pivs.get  (1).p 
    d           =                            _0p < _1p ? -dif : dif 
    x2          =                     math.max(last_bar_index , _0i) + 8
    l0_1        =      fLast.   lf_0.get_line1(), l0_2        =      fLast.   lf_0.get_line2()
    lM01        =      fLast.   lfM0.get_line1(), lM02        =      fLast.   lfM0.get_line2()    
    lM11        =      fLast.   lfM1.get_line1(), lM12        =      fLast.   lfM1.get_line2()
    l1_1        =      fLast.   lf_1.get_line1(), l1_2        =      fLast.   lf_1.get_line2()

    if (ph or pl) and sF 
        l0_1        .set_xy1(_0i, _0p + (d * 0.382)), l0_1        .set_xy2( x2, _0p + (d * 0.382))
        l0_2        .set_xy1(_0i, _0p              ), l0_2        .set_xy2( x2, _0p              )
        lM01        .set_xy1(_0i, _0p - (d * 0.236)), lM01        .set_xy2( x2, _0p - (d * 0.236))
        lM02        .set_xy1(_0i, _0p - (d * 0.382)), lM02        .set_xy2( x2, _0p - (d * 0.382))
        lM11        .set_xy1(_0i, _0p - (d * 0.618)), lM11        .set_xy2( x2, _0p - (d * 0.618))
        lM12        .set_xy1(_0i, _0p - (d * 0.764)), lM12        .set_xy2( x2, _0p - (d * 0.764))
        l1_1        .set_xy1(_0i, _0p -  d         ), l1_1        .set_xy2( x2, _0p -  d         )
        l1_2        .set_xy1(_0i, _1p - (d * 0.382)), l1_2        .set_xy2( x2, _1p - (d * 0.382))
        fLast.ln_0_5.set_xy1(_0i, _0p - (d * 0.5  )), fLast.ln_0_5.set_xy2( x2, _0p - (d * 0.5  ))
        fLast.diagon.set_xy1(_0i, _0p              ), fLast.diagon.set_xy2(_1i, _1p              )
        fLast.lab   .set_xy (_0i, _0p )
        fLast.lab   .set_style       (_1p > _0p ? label.style_label_up : label.style_label_down  )
    else 
        l0_1        .set_x2 ( n + 8 )
        l0_2        .set_x2 ( n + 8 )
        lM01        .set_x2 ( n + 8 )
        lM02        .set_x2 ( n + 8 )
        lM11        .set_x2 ( n + 8 )
        lM12        .set_x2 ( n + 8 )
        l1_1        .set_x2 ( n + 8 )
        l1_2        .set_x2 ( n + 8 )
        fLast.ln_0_5.set_x2 ( n + 8 )

if f.active 
    lv1 = opt == '0.000 - 1.000' ? f._0_000 : opt == '0.236 - 0.764' ? f._0_236 : opt == '0.382 - 0.618' ? f._0_382 : f.n0_382
    lv2 = opt == '0.000 - 1.000' ? f._1_000 : opt == '0.236 - 0.764' ? f._0_764 : opt == '0.382 - 0.618' ? f._0_618 : f._1_382

    max = math.max(lv1.get_y2(), lv2.get_y2())
    min = math.min(lv1.get_y2(), lv2.get_y2())

    if close < max and close > min 
        f.count := 0
    else
        if close > max or close < min 
            f.count += 1
    if f.count > c
        f.n0_382.set_xy1(na, na), f.n0_382.set_xy2(na, na)
        f._0_000.set_xy1(na, na), f._0_000.set_xy2(na, na)        
        f._0_236.set_xy1(na, na), f._0_236.set_xy2(na, na)
        f._0_382.set_xy1(na, na), f._0_382.set_xy2(na, na)
        f._0_500.set_xy1(na, na), f._0_500.set_xy2(na, na)
        f._0_618.set_xy1(na, na), f._0_618.set_xy2(na, na)        
        f._0_764.set_xy1(na, na), f._0_764.set_xy2(na, na)
        f._1_000.set_xy1(na, na), f._1_000.set_xy2(na, na)
        f._1_382.set_xy1(na, na), f._1_382.set_xy2(na, na)
        f.diagon.set_xy1(na, na), f.diagon.set_xy2(na, na)
        f.lab1  .set_xy (na, na), f.lab2  .set_xy (na, na)
        f.active   := false 

        if  close   > max 
            brokeU := true
        else 
            brokeD := true

    else
        f.n0_382.set_x2(n + 8)
        f._0_000.set_x2(n + 8)        
        f._0_236.set_x2(n + 8)
        f._0_382.set_x2(n + 8)
        f._0_500.set_x2(n + 8)
        f._0_618.set_x2(n + 8)        
        f._0_764.set_x2(n + 8)
        f._1_000.set_x2(n + 8)
        f._1_382.set_x2(n + 8)
        f.lab1  .set_x (n + 8)        
        f.lab2  .set_x (n + 8)
    
//-----------------------------------------------------------------------------}
//Plots
//-----------------------------------------------------------------------------{
plotn0_382 = f.n0_382.get_y2()
plot_0_000 = f._0_000.get_y2()
plot_0_236 = f._0_236.get_y2()
plot_0_382 = f._0_382.get_y2()
plot_0_500 = f._0_500.get_y2()
plot_0_618 = f._0_618.get_y2()
plot_0_764 = f._0_764.get_y2()
plot_1_000 = f._1_000.get_y2()
plot_1_382 = f._1_382.get_y2()

ch = ta.change(plot_0_000)

p1 = plot(ch ? na : plotn0_382 , color=color.new(color.blue, 100), style=plot.style_steplinebr)
p2 = plot(ch ? na : plot_0_000 , color=color.new(color.blue, 100), style=plot.style_steplinebr)
p3 = plot(ch ? na : plot_0_236 , color=color.new(color.blue, 100), style=plot.style_steplinebr)
p4 = plot(ch ? na : plot_0_382 , color=color.new(color.blue, 100), style=plot.style_steplinebr)
p5 = plot(ch ? na : plot_0_500 , color=color.new(color.blue, 100), style=plot.style_steplinebr)
p6 = plot(ch ? na : plot_0_618 , color=color.new(color.blue, 100), style=plot.style_steplinebr)
p7 = plot(ch ? na : plot_0_764 , color=color.new(color.blue, 100), style=plot.style_steplinebr)
p8 = plot(ch ? na : plot_1_000 , color=color.new(color.blue, 100), style=plot.style_steplinebr)
p9 = plot(ch ? na : plot_1_382 , color=color.new(color.blue, 100), style=plot.style_steplinebr)

fill(p1, p2, ch or not fl ? na : plot_0_000                                            ,                      math.avg(plotn0_382, plot_0_000) , F0 , color.new(chart.bg_color, 100)     )
fill(p1, p2, ch or not fl ? na : plotn0_382                                            ,                      math.avg(plotn0_382, plot_0_000) , F0 , color.new(chart.bg_color, 100)     )
fill(p3, p4, ch or not fl ? na : plot_0_236                                            , math.avg(plot_0_382, math.avg(plot_0_382, plot_0_236)), F_ , color.new(chart.bg_color, 100)     )
fill(p3, p4, ch or not fl ? na : math.avg(plot_0_236, math.avg(plot_0_382, plot_0_236)), plot_0_382                                            ,      color.new(chart.bg_color, 100), F_ )
fill(p4, p5, ch or not fl ? na : plot_0_382                                            , plot_0_500                                            ,      color.new(chart.bg_color, 100), Fm )
fill(p5, p6, ch or not fl ? na : plot_0_500                                            , plot_0_618                                            , Fm , color.new(chart.bg_color, 100)     )
fill(p6, p7, ch or not fl ? na : plot_0_764                                            , math.avg(plot_0_618, math.avg(plot_0_618, plot_0_764)), Fp , color.new(chart.bg_color, 100)     )
fill(p6, p7, ch or not fl ? na : math.avg(plot_0_764, math.avg(plot_0_618, plot_0_764)), plot_0_618                                            ,      color.new(chart.bg_color, 100), Fp )
fill(p8, p9, ch or not fl ? na : plot_1_000                                            ,                      math.avg(plot_1_382, plot_1_000) , F1 , color.new(chart.bg_color, 100)     )
fill(p8, p9, ch or not fl ? na : plot_1_382                                            ,                      math.avg(plot_1_382, plot_1_000) , F1 , color.new(chart.bg_color, 100)     )

plotshape(sb and brokeU and f.active[1] ? high : na, location=location.abovebar, style=shape.labeldown, size=size.tiny, color=#089981)
plotshape(sb and brokeD and f.active[1] ? low  : na, location=location.belowbar, style=shape.labelup  , size=size.tiny, color=#f23645)

//-----------------------------------------------------------------------------}
//Alerts
//-----------------------------------------------------------------------------{
alertcondition(brokeU and f.active[1], 'break Up'  , 'break Up'  )
alertcondition(brokeD and f.active[1], 'break Down', 'break Donw')

//-----------------------------------------------------------------------------}