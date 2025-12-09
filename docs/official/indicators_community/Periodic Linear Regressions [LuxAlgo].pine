// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator(    'Periodic Linear Regressions [LuxAlgo]'
 , shorttitle='LuxAlgo - Periodic Linear Regressions'
 , max_lines_count=500
 , overlay=true
 )

//---------------------------------------------------------------------------------------------------------------------}
// Settings
//---------------------------------------------------------------------------------------------------------------------{
choice       =                       input.string   ('Rolling', 'Method'      , options=[ 'Static', 'Rolling'])
anchor       =                       input.string   ('Periodic','Anchor Type' , options=['Periodic', 'First Bar']
             ,                       tooltip        =  "'First Bar' -> Choice: 'Rolling' "                        )
res          =                       input.timeframe(   'W'   ,'Anchor Period'                                     )
src          =                       input.source   (close   , 'Source'                                             )
mult         =                       input.float    (1      ,  'Multiple'     , step=0.1 , minval=0.1                )
bands        =                       input.bool     (true  ,   'Show Extremities'                                     )
col          =                       input.color(#FF5D00 ,'Mono color          ', group='Color Settings', inline='1')
bicolor      =                       input.bool     (true   ,   'Bicolor        ' , group='Color Settings', inline='a')
colA         =                       input.color    (#089981,       ''          , group='Color Settings', inline='a')
colB         =                       input.color    (#F23645 ,      ''          , group='Color Settings', inline='a')
grad         =                       input.bool     (    true   , 'Gradient'      , group='Color Settings', inline='c')
grade        =                       input.int      (15,'    ' ,minval=0,maxval=50, group='Color Settings', inline='c')
showDash     =                       input.bool     (    true , 'Show Dashboard'  , group=    'Dashboard'           )
dashLoc      = str.replace(str.lower(input.string   (  'Top Right'                ,           'Location'  
   , options =                      ['Top Right' , 'Bottom Right', 'Bottom Left'] , group=  'Dashboard'        ))
   , ' ', '_')
textSize     =             str.lower(input.string   ( 'Normal'                    ,             'Size'      
   , options =                      ['Tiny', 'Small', 'Normal']                   , group='Dashboard'    ))

//---------------------------------------------------------------------------------------------------------------------}
//Variables
//---------------------------------------------------------------------------------------------------------------------{
var tb = table.new(dashLoc, 2, 3
  , bgcolor      = #1e222d
  , border_color = #373a46
  , border_width = 1
  , frame_color  = #373a46
  , frame_width  = 1)

lbi = last_bar_index
n   = bar_index
INV = color(na)

//---------------------------------------------------------------------------------------------------------------------}
//Function
//---------------------------------------------------------------------------------------------------------------------{
draw(res, src, choice, anchor, bands, col, idx) =>

    float yMx    = na
    float dist   = na

    ch = timeframe.change(res)

    var line ln  = na
    var line lnU = na
    var line lnD = na

    var aX  = array.new< int >()        
    var aY  = array.new<float>()
    var Ex  = 0.   , var Ey  = 0. 
    var Ex2 = 0.   , var Exy = 0.  
    var N   = 0

    Ex   += n                //sum x
    Ey   += src              //sum y 
    Ex2  += math.pow(n, 2)   //sum x²
    Exy  += n * src          //sum x*y
    N    += 1                //population size

    //add x & y values to array
    aX.unshift( n )
    aY.unshift(src)

    cov   = aY. covariance(aX)
    x_var = aX.   variance(  )
    a_    =            cov / x_var
    b_    = aY.avg() - a_  * aX.avg()
    r2    = math.pow(  cov / (aY.stdev() 
                           *  aX.stdev()), 2)
    rss   = aY.variance()  
          - r2 
          * aY.variance()         

    dist := math.sqrt(rss) 
          * mult

    m = (N * Exy - Ex * Ey) / (N * Ex2 - math.pow(Ex, 2))
    b = (Ey - m * Ex) / N

    yMx := m * n + b
    
    if choice == 'Static'    
        cl = bicolor 
           ? ln.get_y2() > ln.get_y1() 
           ? colA : colB : col

        x1 =      ln.get_x1()    
        ln.set_xy2(n ,   yMx ) 
        ln.set_y1 (m * x1 + b)

        if bicolor 
            ln.set_color(cl)

        if bands 
            lnU.set_xy2(n , yMx   +   dist)
            lnU.set_y1 (m * x1  + b + dist)
            lnU.set_color(cl)

            lnD.set_xy2(n , yMx   -   dist)
            lnD.set_y1 (m * x1  + b - dist)
            lnD.set_color(cl)

    if ch
        if  anchor == 'Periodic' 
         or choice == 'Static' 
            Ex  := 0. 
            Ey  := 0. 
            Ex2 := 0. 
            Exy := 0. 
            aX.clear() 
            aY.clear()
        N   := 0
        if choice == 'Static'    
            ln      := line.new(n, src       , n, src       , color=col)
            if bands 
                lnU := line.new(n, src + dist, n, src + dist, color=col)
                lnD := line.new(n, src - dist, n, src - dist, color=col)

    R = cov / (aX.stdev() * aY.stdev())

    [  choice == 'Rolling'           ? yMx        : na
     , choice == 'Rolling' and bands ? yMx + dist : na
     , choice == 'Rolling' and bands ? yMx - dist : na 
     , R
     ]
            
//---------------------------------------------------------------------------------------------------------------------}
//Execution
//---------------------------------------------------------------------------------------------------------------------{
[yMx, yMx_pos, yMx_min, R]    =    draw(res, src, choice, anchor, bands, col, 0)

//---------------------------------------------------------------------------------------------------------------------}
//Plot
//---------------------------------------------------------------------------------------------------------------------{
rolling    =    bicolor and choice == 'Rolling'
m = plot(yMx    , color=rolling ? color.from_gradient(R, -1, 1, colB, colA) : col, style=plot.style_linebr)
b = plot(yMx_min, color=rolling ? color              (         na         ) : col, style=plot.style_linebr)
t = plot(yMx_pos, color=rolling ? color              (         na         ) : col, style=plot.style_linebr)

fill(m, t, yMx, yMx_pos,  grad  ? color.new          ( 
                                  color.from_gradient(R, -1, 1, colB, colA) , 100                    ) : na
                       ,  grad  ? color.new          ( 
                                  color.from_gradient(R, -1, 1, colB, colA) , 100  -     grade       ) : na)
fill(m, b, yMx, yMx_min,  grad  ? color.new          ( 
                                  color.from_gradient(R, -1, 1, colB, colA) , 100                    ) : na
                       ,  grad  ? color.new          ( 
                                  color.from_gradient(R, -1, 1, colB, colA) , 100  -     grade       ) : na)

//---------------------------------------------------------------------------------------------------------------------}
//Dashboard
//---------------------------------------------------------------------------------------------------------------------{
if barstate.islast
    if showDash
        tb.cell(0, 0,     'HTF'        , text_color=color.white, text_size=textSize)
        tb.cell(1, 0, str.tostring(res), text_color=color.white, text_size=textSize)

//---------------------------------------------------------------------------------------------------------------------}