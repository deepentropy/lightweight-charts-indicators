// This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/
// © LuxAlgo

//@version=5
indicator('Three Drive Pattern Detector [LuxAlgo]', shorttitle='LuxAlgo - Three Drive Pattern Detector', max_labels_count=500, max_lines_count=500, max_boxes_count=500, max_polylines_count = 100, max_bars_back=5000, calc_bars_count=10000, overlay=true)

//------------------------------------------------------------------------------
// Settings
//-----------------------------------------------------------------------------{
s = '     '
t = '             '
u = '                               '
stt        =                       input.int(  3,  'Minimum Swing Length ' + t , minval= 1    , maxval=    99, inline='1')
num        =    math.max(stt +1  , input.int(100,  'Maximum Swing Length'  + t , minval= 2    , maxval=   100, inline='2'))
ret_L      = input.float(0.618     ,               'Retracement'  , step= 0.002, minval= 0.5  , maxval= 0.618, inline='r'  )
ret_H      = input.float(0.786     ,                   '-'        , step= 0.002, minval= 0.786, maxval= 0.9  , inline='r'   )
ext_L      = input.float(1.272     ,               'Extension'+s  , step= 0.002, minval= 1.1  , maxval= 1.272, inline='e'    )
ext_H      = input.float(1.618     ,                   '-'        , step= 0.002, minval= 1.618, maxval= 1.8  , inline='e'     )
widthPerc  = input.float(100,'Width Margin'+u, inline='3', tooltip='Margin between duration of\nthe extensions/retracements'   ) 
colBl      = input.color(#089981   , 'Bullish'         , group='Style'                                                         )
colBr      = input.color(#f23645  ,  'Bearish'         , group='Style'                                                           )
textSize   = str.lower(input.string('Small', 'Text Size' , group='Style'    , options=  [     'Tiny'  ,   'Small'  ,  'Normal'     ]))
showRatios = input.string('None'  , 'Show Ratios'        , group='Style'    , options = [  'None', 'Ratios', 'Ratios With Margin'  ] )
showDash   = input.bool (true    , 'Show Dashboard'      , group='Dashboard'                                                         )
table_position = str.replace(str.lower(
             input.string('Top Right', 'Location'        , group='Dashboard', options = ['Top Right', 'Bottom Right', 'Bottom Left'] )
                         ), " ", "_")
table_size = str.lower(input.string('Small', 'Size'      , group='Dashboard', options=  [     'Tiny'  ,   'Small'  ,  'Normal'     ]))

dif        = num - stt
INV        = color(na) 

//-----------------------------------------------------------------------------}      
//UDT's
//-----------------------------------------------------------------------------{
type piv     
    int   d
    int   x 
    float y

type ZZ 
    array<piv>piv

type drawing
    array<chart.point>points
    polyline          poly 
    box               boxAT
    box               boxAB 
    box               boxBT 
    box               boxBB
    box               boxCT 
    box               boxCB 
    box               boxDT
    box               boxDB
    array < line  >   lines
    array < label >   labels

//-----------------------------------------------------------------------------}      
//Variables
//-----------------------------------------------------------------------------{
int   n   = bar_index
var array<   ZZ    >arrayZZ  = array.new<   ZZ    >(     ) 
var array< drawing >drawings = array.new< drawing >(     )
var array< string  >lastTime = array.new< string  >(1, "")

var tb = table.new(table_position, 1, 1
  , bgcolor      = #1e222d
  , border_color = #373a46
  , border_width = 1
  , frame_color  = #373a46
  , frame_width  = 1)

if barstate.isfirst 
    //First bar
    line.new(n, close, n, close + syminfo.mintick, extend=extend.both)
    for i = 0 to dif -1
        ZZnew = ZZ.new(array.new<piv>())
        for j = 0 to 5 
            ZZnew.piv.unshift(piv.new(0, 0, high))

        arrayZZ.unshift(ZZnew) 

array<int>arrBin = array.from(na, na, na)

showRt = showRatios == 'Ratios' 
showBx = showRatios == 'Ratios With Margin' 

//-----------------------------------------------------------------------------}      
//Methods
//-----------------------------------------------------------------------------{
method in_out(ZZ aZZ, int d, int Dx, float Dy) => aZZ.piv.unshift(piv.new(d, Dx, Dy)), aZZ.piv.pop()

method n(float v) => not na(v) 

method lab(float level, float levelL, float levelH, int x1, int x2, float y1, float y2, float num, color col) => 
    label.new(math.round(math.avg(x1, x2)), math.avg(y1, y2)
     , style=label.style_label_center, color=INV, textcolor=col
     , size=textSize, text=str.tostring(math.round(num, 3))
     , tooltip=str.format("{0}\n   ┬\n{1}\n   ┴\n{2}", levelH, level, levelL))

method lin(array<line>arrLn, int x1, float y1, int x2, float y2) => arrLn.unshift(line.new(x1, y1, x2, y2, color=color.silver, style=line.style_dotted))


method extensions(float levelL, float levelH, float Ay, float By, float Dy, int Dd) => 
    isValid = switch Dd
        1 =>   
            distance = By - Ay
            Dy >= Ay + distance * levelL and Dy <= Ay + distance * levelH 
        =>  
            distance = Ay - By
            Dy >= Ay - distance * levelH and Dy <= Ay - distance * levelL 

method retrace(float levelL, float levelH, float By, float Cy, float Dy, int Dd) => 
    isValid = switch Dd
        1 =>   
            distance = By - Cy
            Dy >= Cy + distance * levelL and Dy <= Cy + distance * levelH 
        =>  
            distance = Cy - By
            Dy >= Cy - distance * levelH and Dy <= Cy - distance * levelL 

method zigzag(array<ZZ>arrZZ, int index, int left, int right) =>
    aZZ      = arrZZ.get(index)
    ph       = ta.pivothigh(left, right)
    pl       = ta.pivotlow (left, right)

    if ph.n()
        piv  = aZZ.piv.first()
        dr_  = piv.d 
        Cx_  = piv.x 
        Cy_  = piv.y 
        Dx_  = n  - right
        Dy_  = high[right]
        //
        if Dy_ > Cy_
            if dr_ <  1  // if previous point was a pl, add, and change direction ( 1)
                aZZ.in_out( 1, Dx_, Dy_)
            else
                if dr_ ==  1 and ph > Cy_
                    piv.x := Dx_, piv.y := Dy_   

    if pl.n() 
        piv  = aZZ.piv.first()
        dr_  = piv.d 
        Cx_  = piv.x 
        Cy_  = piv.y 
        Dx_  = n  - right
        Dy_  = low [right]
        //
        if Dy_ < Cy_
            if dr_ > -1  // if previous point was a ph, add, and change direction (-1)
                aZZ.in_out(-1, Dx_, Dy_)
            else
                if dr_ == -1 and pl < Cy_ 
                    piv.x := Dx_, piv.y := Dy_    

    Y = aZZ.piv.get(5), Yx = Y.x, Yy = Y.y
    Z = aZZ.piv.get(4), Zx = Z.x, Zy = Z.y
    A = aZZ.piv.get(3), Ax = A.x, Ay = A.y
    B = aZZ.piv.get(2), Bx = B.x, By = B.y
    C = aZZ.piv.get(1), Cx = C.x, Cy = C.y
    D = aZZ.piv.get(0), Dx = D.x, Dy = D.y, dir = D.d 

    widthsRetrace = array.from(Ax - Zx, Cx - Bx)
    widthsExtenss = array.from(Zx - Yx, Bx - Ax, Dx - Cx)

    minRetrace = widthsRetrace.min(), maxRetrace = widthsRetrace.max() 
    minExtenss = widthsExtenss.min(), maxExtenss = widthsExtenss.max() 

    if   ext_L.extensions(ext_H, Ay, By, Dy, aZZ.piv.get(0).d) 
     and ret_L.retrace   (ret_H, Ay, By, Cy, aZZ.piv.get(1).d) 
     and ext_L.extensions(ext_H, Yy, Zy, By, aZZ.piv.get(2).d) 
     and ret_L.retrace   (ret_H, Yy, Zy, Ay, aZZ.piv.get(3).d) 
     and (100 / minRetrace * maxRetrace - 100) <= widthPerc
     and (100 / minExtenss * maxExtenss - 100) <= widthPerc

        isValid = true 
        if drawings.size() > 0 
            for j = 0 to drawings.size() -1 
                get = drawings.get(j)
                drawDx = get.points.get(5).index 
                if drawDx < Yx 
                    break 
                else
                    if Cx == get.points.get(4).index
                        if Dx == drawDx
                            isValid := false 
                            break 
                        else
                            get.poly.delete()
                            get.boxDT.delete()                            
                            get.boxDB.delete()
                            for ln in get.lines 
                                ln.delete()
                            for lb in get.labels 
                                lb.delete()
                            get.boxAT.delete(), get.boxAB.delete()
                            get.boxBT.delete(), get.boxBB.delete()
                            get.boxCT.delete(), get.boxCB.delete()
                            get.boxDT.delete(), get.boxDB.delete()
                            line.new(Cx, Cy, Dx, Dy
                             , color= Dy > Cy ? colBr : colBl, style=line.style_dashed)  

        if isValid and Dx != 0
            formattedTime = str.format_time(time, "yyyy-MM-dd HH:mm", syminfo.timezone)
            lastTime.set(0, formattedTime)

            int transp = na
            if not na(arrBin.first()) 
                arrBin.set(2,  math.min(90, arrBin.get(2) + 30))
            else
                arrBin.set(0, Yx)
                arrBin.set(1, Dx)
                arrBin.set(2,  0)
            transp := arrBin.get(2)

            pat = drawing.new()
            pat.points := array.from(
               chart.point.from_index(Yx, Yy)
             , chart.point.from_index(Zx, Zy)
             , chart.point.from_index(Ax, Ay)
             , chart.point.from_index(Bx, By)
             , chart.point.from_index(Cx, Cy)
             , chart.point.from_index(Dx, Dy)
             )
            switch dir == 1
                true =>
                    if showBx or showRt
                        midA = math.max(Yy, Zy - (Zy - Yy) * 0.618)
                        midB = math.max(Zy, Yy + (Zy - Yy) * 1.272)
                        midC = math.max(Ay, By - (By - Ay) * 0.618)
                        midD = math.max(By, Ay + (By - Ay) * 1.272)
                        pat.boxAT := box.new(Ax - 1, showRt ? midA : Zy - (Zy - Yy) * ret_L, Ax + 1, midA, bgcolor=INV, border_color=color.new(colBr, 50))   
                        pat.boxBT := box.new(Bx - 1, showRt ? midB : Yy + (Zy - Yy) * ext_H, Bx + 1, midB, bgcolor=INV, border_color=color.new(colBr, 50)) 
                        pat.boxCT := box.new(Cx - 1, showRt ? midC : By - (By - Ay) * ret_L, Cx + 1, midC, bgcolor=INV, border_color=color.new(colBr, 50))
                        pat.boxDT := box.new(Dx - 1, showRt ? midD : Ay + (By - Ay) * ext_H, Dx + 1, midD, bgcolor=INV, border_color=color.new(colBr, 50))    
                        if showBx
                            pat.boxAB := box.new(Ax - 1, midA, Ax + 1, math.max(Yy, Zy - (Zy - Yy) * ret_H), bgcolor=INV, border_color=color.new(colBr, 50))        
                            pat.boxBB := box.new(Bx - 1, midB, Bx + 1, math.max(Zy, Yy + (Zy - Yy) * ext_L), bgcolor=INV, border_color=color.new(colBr, 50))        
                            pat.boxCB := box.new(Cx - 1, midC, Cx + 1, math.max(Ay, By - (By - Ay) * ret_H), bgcolor=INV, border_color=color.new(colBr, 50))
                            pat.boxDB := box.new(Dx - 1, midD, Dx + 1, math.max(By, Ay + (By - Ay) * ext_L), bgcolor=INV, border_color=color.new(colBr, 50))    
                =>
                    if showBx or showRt
                        midA = math.min(Yy, Zy + (Yy - Zy) * 0.618)
                        midB = math.min(Zy, Yy - (Yy - Zy) * 1.272)
                        midC = math.min(Ay, By + (Ay - By) * 0.618)
                        midD = math.min(By, Ay - (Ay - By) * 1.272)
                        pat.boxAT := box.new(Ax - 1, showRt ? midA : math.min(Yy, Zy + (Yy - Zy) * ret_H), Ax + 1, midA, bgcolor=INV, border_color=color.new(colBl, 50))
                        pat.boxBT := box.new(Bx - 1, showRt ? midB : math.min(Zy, Yy - (Yy - Zy) * ext_L), Bx + 1, midB, bgcolor=INV, border_color=color.new(colBl, 50))
                        pat.boxCT := box.new(Cx - 1, showRt ? midC : math.min(Ay, By + (Ay - By) * ret_H), Cx + 1, midC, bgcolor=INV, border_color=color.new(colBl, 50))
                        pat.boxDT := box.new(Dx - 1, showRt ? midD : math.min(By, Ay - (Ay - By) * ext_L), Dx + 1, midD, bgcolor=INV, border_color=color.new(colBl, 50))
                        if showBx
                            pat.boxAB := box.new(Ax - 1, midA, Ax + 1, Zy + (Yy - Zy) * ret_L, bgcolor=INV, border_color=color.new(colBl, 50))
                            pat.boxBB := box.new(Bx - 1, midB, Bx + 1, Yy - (Yy - Zy) * ext_H, bgcolor=INV, border_color=color.new(colBl, 50))
                            pat.boxCB := box.new(Cx - 1, midC, Cx + 1, By + (Ay - By) * ret_L, bgcolor=INV, border_color=color.new(colBl, 50))
                            pat.boxDB := box.new(Dx - 1, midD, Dx + 1, Ay - (Ay - By) * ext_H, bgcolor=INV, border_color=color.new(colBl, 50))

            colr = dir == 1 ? colBr : colBl
            pat.poly := polyline.new(pat.points, line_color= color.new(colr, transp), line_width=2)
            pat.lines  := array.new<line>() 
            pat.labels := array.new<label>()
            pat.lines.unshift(line.new(Yx, Yy, Ax, Ay, color=color.new(colr, 50), style=line.style_dashed))
            pat.lines.unshift(line.new(Zx, Zy, Bx, By, color=color.new(colr, 50), style=line.style_dashed))
            pat.lines.unshift(line.new(Ax, Ay, Cx, Cy, color=color.new(colr, 50), style=line.style_dashed))
            pat.lines.unshift(line.new(Bx, By, Dx, Dy, color=color.new(colr, 50), style=line.style_dashed))

            pat.labels.unshift(0.618.lab(ret_L, ret_H, Yx, Ax, Yy, Ay,     dir == 1 ? 1 / (Zy - Yy) * (Zy - Ay) : 1 / (Yy - Zy) * (Ay - Zy) , colr))
            pat.labels.unshift(1.272.lab(ext_L, ext_H, Zx, Bx, Zy, By, 1 -(dir == 1 ? 1 / (Zy - Yy) * (Zy - By) : 1 / (Yy - Zy) * (By - Zy)), colr))
            pat.labels.unshift(0.618.lab(ret_L, ret_H, Ax, Cx, Ay, Cy,     dir == 1 ? 1 / (By - Ay) * (By - Cy) : 1 / (Ay - By) * (Cy - By) , colr))
            pat.labels.unshift(1.272.lab(ext_L, ext_H, Bx, Dx, By, Dy, 1 -(dir == 1 ? 1 / (By - Ay) * (By - Dy) : 1 / (Ay - By) * (Dy - By)), colr))

            drawings.unshift(pat)

//-----------------------------------------------------------------------------}      
//Execution
//-----------------------------------------------------------------------------{
for i = dif -1 to 0
    arrayZZ.zigzag(i, stt + i, 1)

while drawings.size() > 100 
    pop = drawings.pop()
    if showBx or showRt
        pop.boxAT.delete()  
        pop.boxBT.delete()  
        pop.boxCT.delete()  
        pop.boxDT.delete()  
        if showBx
            pop.boxAB.delete()
            pop.boxBB.delete()
            pop.boxCB.delete()
            pop.boxDB.delete()
    pop.poly.delete() 

//-----------------------------------------------------------------------------}      
//Dashboard
//-----------------------------------------------------------------------------{
if barstate.islast and showDash
    txt = lastTime.first()
    tb.cell(0, 0
     , text=str.format("Last know pattern:\n{0}", txt == "" ? 'None' : txt)
     , text_color=chart.fg_color
     , text_size=table_size
     )

//-----------------------------------------------------------------------------}      