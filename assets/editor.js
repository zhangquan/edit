/*----------------------Document------------------*/
function escapeHTML(s){

return s.replace(/&/g, "&amp;").
replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/ /g,"&nbsp;") }

function Document(value,render){
    this._value = []

}
Document.prototype={
    setValue:function(value){

        this.insert(value,{
            row:0,
            column:0
        });
    },
    getValue:function(){
        return this._value.join("\n");
    },
    onUpdateLine:function(){},
    onRemoveLine:function(){},
    onAddLine:function(){},
    insert:function(value, cursor){

        // {row:3,clum:5}

        var end = cursor?cursor:{
            row:0,
            column:0
        };

        if(!value)return end;
        var lines = this._split(value);
        

        if(lines.length ==1){
            end =this.insertInLine(lines[0],end.row,end.column);
        }else{
            var value = this._value[end.row]||"";
            var tempValue = value.substring(end.column);
            this._value[end.row] = value.substring(0,end.column)+lines[0];
            this.updateLine(this._value[end.row] , end.row);
            lines[lines.length-1] =lines[lines.length-1]+ tempValue
            
            var addLines =[];
            for(var i =1;i<lines.length;i++){
                addLines[i-1]=lines[i];
            }
            
            end =  this.insertNewLines(addLines, end.row+1);

            



        /*var firstLine =lines.splice(0,1)[0];
                        var lastLine = lines.length == 0 ? null : lines.splice(lines.length - 1, 1)[0];

                        end =this.insertInLine(firstLine,end.row,end.column);
                        if (lastLine !== null) {

                            end =this.insertNewLines(lines, end.row+1);
                            end = this.insertInLine(lastLine || "",end.row,end.column);
                        }*/
        }

       

        return end;



    },
    insertInLine:function(value,row,column){

        var line = this._value[row]||"";
        this._value[row] = line.substring(0, column) + value + line.substring(column);

        this.updateLine(this._value[row],row);
        return {
            row:row,
            column:column+value.length
        }

    },


    insertNewLines:function(value, row){

        for(var i=0;i<value.length;i++){
            this._value.splice(row+i, 0 ,value[i]);
            
            this.updateLine(value[i],row+i,true);
        }

        return {
            row:row+value.length,
            column:0
        }
    },
    updateLine:function(value, row, newLine){
        var self = this;

        if(self.onUpdateLine){
            self.onUpdateLine(value,row, newLine)
        }


    },

    breakLine:function(position){

        var line = this._value[position.row];
        var value = line.substring(position.column)||"" ;
        this.removeInLine(position.row,position.column,line.length);
        var lines =[]
        lines[0] = value
        this.insertNewLines(lines,position.row+1)


    },
    remove:function(range){
        var start = range.start,
        end = range.end;


        var  num = end.row - start.row;
        if(num == 0) this.removeInLine(start.row, start.column, end.column);
        if(num > 0){


            var  first =  this._value[start.row];
            var last = this._value[end.row];

            this._value[start.row] = first.substring(0, start.column)+last.substring(end.column);
            
            this.updateLine( this._value[start.row] ,start.row);
            var newLines = [];
            for(var i = 0;i<num;i++){
                newLines.push(start.row+i+1);
            }

            this.removeNewLines(newLines)



        }

        return start;

    },
    removePrevChar:function(range){
        var row = range.start.row,
        column = range.start.column;
        if(row==0&&column==0){
            return;
        }
        if(column == 0){
            range.start.row =row -1;
            range.start.column = this._value[row-1].length-1;
        }else{
            range.start.column = column-1;
        }
        return  this.remove(range)





    },
    removeInLine:function(row, start ,end){

        var value = this._value[row];
        if(value){
            this._value[row] = value.substring(0,start);

            if(end)this._value[row]+=value.substring(end)


            this.updateLine(this._value[row],row);
        }


    },
    removeNewLines:function(lines){

        this._value.splice(lines[0], lines.length-1 );
        for(var i = lines.length-1;i>=0;i--){
            console.log("remove line: "+lines[i])
            this.updateLine(null,lines[i]);
        }
    },
    replace:function(value, range){
        var range =  this.remove(range);

        return  this.insert(value,range);
    },

    _split:function(value){

        return  value.replace(/\r\n|\r/g, "\n").split("\n");

    }
}





/*----------------------render------------------*/

function Render(doc){
    this.container = $("#editor");
    this.text = $(".text");
    this.cursor = $(".cursor");
    this.cursorPosition={
        x:0,
        y:0
    },
    this.range={
        x:0,
        y:0
    },
    this.input = $(".input");
    this.charSize = this.measureSizes();
    this.doc=doc;
    var self=this;
    this.doc.onUpdateLine=function(value,row, newLine){

        self.renderLine(value, row,newLine);

    }
    this.on();
}

Render.prototype={
    on:function(){
        var self=this;
        var el = this.container;
        el.bind("select",function(ev){
            ev.preventDefault();
        })

        el.focusin(function(){
            self.showCursor();
            self.input.focus();


        })
        el.focusout(function(){
            self.hideCursor();
            self.input.blur();
        })

        el.mousedown(function(ev){
            self.status = true;

            var pageX = ev.pageX,
            pageY = ev.pageY;

            var offset = el.offset();
            self.setCursorPosition(pageX - offset.left, pageY - offset.top-10);
            var start = this.rangeStart = self.getCursorPosition();
            self.clearRange()
            self.setRange(start,start)


            self.input.focus();
            ev.preventDefault();

        })
        el.mouseup(function(ev){
            self.status = false;

        })

        el.mousemove(function(ev){
            if(self.status){
                var pageX =ev.pageX;
                var pageY =ev.pageY;
                var offset = el.offset();
                self.setCursorPosition(pageX - offset.left, pageY - offset.top-10);
                var start =  this.rangeStart ;

                var temp;
                var end = self.getCursorPosition();

                if(start.row>end.row || ((start.row == end.row)&&start.column>end.column)){
                    temp = start;
                    start =end;
                    end = temp;
                }

                self.setRange(start,end);

            }
        })




        self.input.bind("keydown",function(ev){

            var keyCode = ev.keyCode;

            var height = self.charSize.height,
            width  =self.charSize.width;

            //delete
            if(keyCode ==8){
                if(self.hasRange(self.getRange())){
                    var position =  self.doc.remove(self.getRange());
                    self.setCursorRowColumn(position.row,position.column);
                    self.setRange(self.getCursorPosition(),self.getCursorPosition())
                } else{
                    var position =  self.doc.removePrevChar(self.getRange());
                    self.setCursorRowColumn(position.row,position.column);
                    self.setRange(self.getCursorPosition(),self.getCursorPosition())
                }

                ev.preventDefault();
            }
            //left
            else if(keyCode ==37){
                self.cursorLeftColumn();
                self.setRange(self.getCursorPosition(),self.getCursorPosition())
                ev.preventDefault()
            }
            //up
            else if(keyCode ==38){
                self.cursorUpRow()
                self.setRange(self.getCursorPosition(),self.getCursorPosition())
                ev.preventDefault()
            }
            //right
            else if(keyCode ==39){
                self.cursorRightColumn()
                self.setRange(self.getCursorPosition(),self.getCursorPosition())
                ev.preventDefault()
            }
            //down
            else if(keyCode ==40){
                self.cursorDownRow();
                self.setRange(self.getCursorPosition(),self.getCursorPosition())
                ev.preventDefault()
            }
            //enter
            else if(keyCode ==13){

                self.doc.breakLine({
                    column:self.cursorPosition.column,
                    row:self.cursorPosition.row
                });
                self.setCursorY(self.cursorPosition.y+height);
                self.setCursorX(0);
                self.setRange(self.getCursorPosition(),self.getCursorPosition())
                ev.preventDefault()

            }
        //default
        /*    else{
                            var value = self.input.val();
                            if(!value) return;

                            if(self.hasRange(self.getRange())){
                                console.log("repalce")
                                self.doc.replace(value, self.getRange());
                                self.setCursorX(self.cursorPosition.x+width);
                                self.setRange(self.getCursorPosition(),self.getCursorPosition())
                            }
                            else {
                                console.log("insert")
                                var cursor =  self.doc.insert(value, self.getRange().end);
                                self.setCursorRowColumn(cursor);
                                self.setRange(self.getCursorPosition(),self.getCursorPosition())
                            }


                        }
                        self.input.val("");
                         */


        })
        self.input.keyup(function(){
            var height = self.charSize.height,
            width  =self.charSize.width;
            var value = self.input.val();
            if(!value) return;
            if(self.hasRange(self.getRange())){
                
                var cursor = self.doc.replace(value, self.getRange());
                
                self.setCursorRowColumn(cursor.row,cursor.column);
                self.setRange(self.getCursorPosition(),self.getCursorPosition())
            }
            else {
                
                var cursor =  self.doc.insert(value, self.getRange().end);
                
                self.setCursorRowColumn(cursor.row,cursor.column);
                self.setRange(self.getCursorPosition(),self.getCursorPosition())
            }
            self.input.val("")

        });





    },


    showCursor:function(){

        var self=this;
        this._cursorTimer =window.setInterval(function(){
            self.cursor.toggleClass("show")
        }, 250)
    },
    hideCursor:function(){
        if( this._cursorTimer){
            window.clearInterval(this._cursorTimer);
            this._cursorTimer = null;
        }

        this.cursor.toggleClass("show",false)

    },


    renderLine:function(value, row, newRow){
        var temp = value;
        value="";
        var token= tokens(temp);
        token=token?token:[];
        for(var i=0;i<token.length;i++){
            if(token[i].type=="string")token[i].value ='"'+token[i].value+'"';
            if(token[i].type=="comment")token[i].value ='//'+token[i].value;
          /*  if(token[i].type=="whitespace"){
                var ws="";
                for(var j=0;j<token[i].value.length;j++){
                    ws+="&nbsp;"
                }
                token[i].value =ws;
            }*/
            value+='<span class='+token[i].type+'>'+escapeHTML(token[i].value)+'</span>'
        }

        
       
        var lineNode= $(".line:eq("+row+")",this.text);
        
        if(newRow){

            var newLine =  $('<div class="line" style="height:'+this.charSize.height+'px"></div>');
            if(lineNode.length!=0) newLine.insertBefore(lineNode);
            else this.text.append(newLine);
            lineNode = newLine;
        }


        if(value==null&&lineNode.length!=0){
            lineNode.remove();
            return;
        }
       




        if(lineNode.length==0){

            lineNode =  $('<div class="line" style="height:'+this.charSize.height+'px"></div>');

            this.text.append(lineNode);
        }

        lineNode.html(value);

    },
    escapeHtml:function(){

    },
    newLine:function(){

    },
    isFullWidth:function(c) {
        if (c < 0x1100)
            return false;
        return c >= 0x1100 && c <= 0x115F ||
        c >= 0x11A3 && c <= 0x11A7 ||
        c >= 0x11FA && c <= 0x11FF ||
        c >= 0x2329 && c <= 0x232A ||
        c >= 0x2E80 && c <= 0x2E99 ||
        c >= 0x2E9B && c <= 0x2EF3 ||
        c >= 0x2F00 && c <= 0x2FD5 ||
        c >= 0x2FF0 && c <= 0x2FFB ||
        c >= 0x3000 && c <= 0x303E ||
        c >= 0x3041 && c <= 0x3096 ||
        c >= 0x3099 && c <= 0x30FF ||
        c >= 0x3105 && c <= 0x312D ||
        c >= 0x3131 && c <= 0x318E ||
        c >= 0x3190 && c <= 0x31BA ||
        c >= 0x31C0 && c <= 0x31E3 ||
        c >= 0x31F0 && c <= 0x321E ||
        c >= 0x3220 && c <= 0x3247 ||
        c >= 0x3250 && c <= 0x32FE ||
        c >= 0x3300 && c <= 0x4DBF ||
        c >= 0x4E00 && c <= 0xA48C ||
        c >= 0xA490 && c <= 0xA4C6 ||
        c >= 0xA960 && c <= 0xA97C ||
        c >= 0xAC00 && c <= 0xD7A3 ||
        c >= 0xD7B0 && c <= 0xD7C6 ||
        c >= 0xD7CB && c <= 0xD7FB ||
        c >= 0xF900 && c <= 0xFAFF ||
        c >= 0xFE10 && c <= 0xFE19 ||
        c >= 0xFE30 && c <= 0xFE52 ||
        c >= 0xFE54 && c <= 0xFE66 ||
        c >= 0xFE68 && c <= 0xFE6B ||
        c >= 0xFF01 && c <= 0xFF60 ||
        c >= 0xFFE0 && c <= 0xFFE6;
    },
    stringRepeat:function  (string, count) {
        return new Array(count + 1).join(string);
    },
    measureSizes:function() {
        var n = 1000;

        var measureNode =  $("<div>");
        measureNode.css({
            height:"auto",
            width:"auto",
            visibility : "hidden",
            position : "absolute",
            overflow : "visible",
            whiteSpace : "nowrap"

        })
        // in FF 3.6 monospace fonts can have a fixed sub pixel width.
        // that's why we have to measure many characters
        // Note: characterWidth can be a float!
        measureNode.html(this.stringRepeat("Xy", n));


        measureNode.appendTo(this.container);

        var size = {
            height: measureNode.height(),
            width: measureNode.width() / (n * 2)
        };



        return size;
    },
    setCursorY:function (y){
        var p  = this.cursorPosition;
        p.row = Math.round((y)/this.charSize.height);
       
       

        if(p.row<=0)p.row=0
        if(p.row>=this.doc._value.length-1)p.row=this.doc._value.length-1;
       
        p.y=p.row*this.charSize.height;
        this.cursor.css("top", p.y+"px");
        this.input.css("top", p.y+"px");

    },
    setCursorRow:function (row){
        var p  = this.cursorPosition;
        p.row = row;
        p.y=row*this.charSize.height;

        this.cursor.css("top", p.y+"px");
        this.input.css("top", p.y+"px");

    },
    setCursorX:function (x){
        var p  = this.cursorPosition;
        
        p.column = Math.round(x/this.charSize.width);
        var length =this.doc._value[p.row].length;
        if(p.column<=0)p.column=0;
        if(p.column>=length)p.column=length;

        p.x = p.column*this.charSize.width;
        this.cursor.css("left", p.x+"px");
        this.input.css("left", p.x+10+"px");

    },
    setCursorColumn:function (column){
        
        var p  = this.cursorPosition;

        p.column =column;
        p.x = p.column*this.charSize.width;
        this.cursor.css("left", p.x+"px");
        this.input.css("left", p.x+10+"px");

    },
    cursorRightColumn:function(){
        this.setCursorX(this.cursorPosition.x+this.charSize.width);
    },
    cursorDownRow:function(){
        this.setCursorY(this.cursorPosition.y+this.charSize.height);
    },
    cursorLeftColumn:function(){
        this.setCursorX(this.cursorPosition.x-this.charSize.width);
    },
    cursorUpRow:function(){
        this.setCursorY(this.cursorPosition.y-this.charSize.height);
    },

    setCursorPosition:function (x,y){

        this.setCursorY(y);
        this.setCursorX(x);
    },
    setCursorRowColumn:function(row,column){
        this.setCursorRow(row);
        this.setCursorColumn(column);
    },
    getCursorPosition:function(){
        var o ={};
        $.extend(o,this.cursorPosition) ;
        return o;
    },
    setRange:function(start, end){
        this.range={
            start:$.extend({},start),
            end:$.extend({},end)
        };
        this.renderRange(this.range);
    },
    getRange:function(){
        var  o ={};
        return $.extend(o,this.range) ;
    },
    renderRange:function(range){
        this.clearRange();
        var start = range.start,
        end = range.end,
        num = end.row - start.row;
        if(num == 0) this.renderInLineRange(start.y,start.x, end.x);
        if(num > 0){
            var newLines = [];
            for(var i = 0;i<num-1;i++){
                newLines.push((start.row+1)*this.charSize.height);
            }
            this.renderInLineRange(start.y,start.x);
            this.renderCenterRange(newLines)
            this.renderLastRange(end.y, 0,end.x)
        }
    },
    renderInLineRange:function(y, start,end){

        $(".first").css({
            height:this.charSize.height+'px',
            top:y+"px",
            left:start+"px"

        })

        if(end!=null){
            $(".first").css({
                width: (end - start)+"px"
            })
        }else{
            $(".first").css({
                width: "100%"
            })
        }
    },
    renderCenterRange:function(lines){
        if(lines.length>0){
            $(".center").css({
                height:this.charSize.height*lines.length+'px',
                top:lines[0]+"px",
                width:"100%"

            })
        }
    },
    renderLastRange:function(y, start,end){

        $(".last").css({
            height:this.charSize.height+'px',
            top:y+"px",
            left:start+"px",
            width:(end - start)+"px"
        })
    },
    clearRange:function(){
        $(".first").attr("style","")
        $(".center").attr("style","")
        $(".last").attr("style","")
    },
    hasRange:function(range){
        var result =true;
        var start = range.start,
        end = range.end;
        if((start.row == end.row)&&(start.column ==end.column)){
            result = false;
        }
        return result;
    }


}



function Editor(text){

    this.doc = new Document(text);

    this.render = new Render(this.doc);

    this.doc.setValue(text);



}