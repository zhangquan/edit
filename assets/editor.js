/*----------------------Document------------------*/
var CMD_ADD = 1,
CMD_REMOVE =2,
CMD_UPDATE =3;

var actionMemery =[];


var worker;
function escapeHTML(s){

    return (s+"").replace(/&/g, "&amp;").
    replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/ /g,"&nbsp;")
}

function Document(value,render){
    this._value = [];
    this.doneCursor = 0;
    this.memory =true;

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
        var v = value;
        // {row:3,clum:5}

        var start = cursor?cursor:{
            row:0,
            column:0
        };

        if(!value)return start;
        var lines = this._split(value);
        

        if(lines.length ==1){
           var end = this.insertInLine(lines[0],start.row,start.column);
            
        
        }else{
            var value = this._value[start.row]||"";
            var tempValue = value.substring(start.column);
            this._value[start.row] = value.substring(0,start.column)+lines[0];
            this.updateLine(this._value[start.row] , start.row, CMD_UPDATE);
            lines[lines.length-1] =lines[lines.length-1]+ tempValue
            
            var addLines =[];
            for(var i =1;i<lines.length;i++){
                addLines[i-1]=lines[i];
            }
            
            this.insertNewLines(addLines, start.row+1);
            var end = {
                row:start.row+addLines.length,
                column:addLines[addLines.length-1].length
            }

        }
     
        this.done("insert",v,{
            start:cursor,
            end:end
        })

       
        return end;



    },
    insertInLine:function(value,row,column){

        var line = this._value[row]||"";
        this._value[row] = line.substring(0, column) + value + line.substring(column);

        this.updateLine(this._value[row],row, CMD_UPDATE);
        return {
            row:row,
            column:column+value.length
        }

    },


    insertNewLines:function(value, row){

        for(var i=0;i<value.length;i++){
            this._value.splice(row+i, 0 ,value[i]);
            
            this.updateLine(value[i],row+i, CMD_ADD);
        }

        return {
            row:row+value.length-1,
            column:value[value.length-1].length
        }
    },
    updateLine:function(value, row, cmd){
        var self = this;

        if(self.onUpdateLine){
            self.onUpdateLine(value, row, cmd)
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
    mergeLine:function(row){

    },
    remove:function(range){
      
        var start = range.start,
        end = range.end;
        var value =this.getRangeValue(range);
        console.log("remove:"+value)
        var  num = end.row - start.row;
        if(num == 0) this.removeInLine(start.row, start.column, end.column);
        if(num > 0){


            var  first =  this._value[start.row];
            var last = this._value[end.row];

            this._value[start.row] = first.substring(0, start.column)+last.substring(end.column);
            
            this.updateLine( this._value[start.row] ,start.row, CMD_UPDATE);
            var newLines = [];
            for(var i = 0;i<num;i++){
                newLines.push(start.row+i+1);
            }

            this.removeNewLines(newLines)
        }
        
        this.done("remove",value,range)

        return start;

    },
    undo:function(){
        var result;
        if(this.doneCursor> actionMemery.length-1)this.doneCursor> actionMemery.length-1;
        var last = actionMemery[this.doneCursor];
        console.log(last)
        if(!last) return;
        this.memory =false;
        if(last.cmd == "insert"){
          
            result=this.remove(last.range);
         
        }
        if(last.cmd == "remove"){
            
            result=this.insert(last.value, last.range.start);
        }
        this.memory =true;
        this.doneCursor--;
        return result;
    },
    done:function(action, value, range){
       
        if(!this.memory)return;
        console.log("memory:"+action+" value " +value+" range "+range)
        actionMemery.push({
            cmd:action,
            value:value,
            range:range
        })
        this.doneCursor = actionMemery.length-1;
    },
    redo:function(){
        var result;
        this.doneCursor++;
        if(this.doneCursor<0)this.doneCursor ==0; 
        var last = actionMemery[this.doneCursor];
        console.log("redo")
        console.log(last);
        if(!last) return;
        this.memory =false;
        if(last.cmd == "insert"){
            result = this.insert(last.value,last.range.start);
        }
        if(last.cmd == "remove"){
            result = this.remove(last.range);
        }
        this.memory =true;
       
        return result;
    },
    removePrevChar:function(range){
        var row = range.start.row,
        column = range.start.column;
        if(row==0&&column==0){
            return {
                row:0,
                column:0
            };
        }
        if(column == 0){
            range.start.row =row -1;
            range.start.column = this._value[row-1].length  ;
        }else{
            range.start.column = column-1;
        }
        console.log("remove");
        console.log(range);
        return  this.remove(range)





    },
    removeInLine:function(row, start ,end){

        var value = this._value[row];
        if(value){
            this._value[row] = value.substring(0,start);

            if(end)this._value[row]+=value.substring(end)


            this.updateLine(this._value[row],row,CMD_UPDATE);
        }


    },
    removeNewLines:function(lines){

        this._value.splice(lines[0], lines.length-1 );
        for(var i = lines.length-1;i>=0;i--){
          
            this.updateLine(null,lines[i],CMD_REMOVE);
        }
    },
    replace:function(value, range){
        var range =  this.remove(range);

        return  this.insert(value,range);
    },
    getRangeValue:function(range){
        var
        result = [],
        start = range.start,
        end = range.end,
        num = end.row - start.row;
        var value = this._value;
        if(num == 0){
            result.push(value[start.row].substring(start.column,end.column))
            
        }
        else if(num>0){

            result.push(value[start.row].substring(start.column))
           
            for(var i = 0;i<num-1;i++){
                result.push(value[start.row+i+1]);
            }
            result.push(value[end.row].substring(0, end.column));
         
         
        }
        return result.join("\n");
     
      
    },

    _split:function(value){

        return  value.replace(/\r\n|\r/g, "\n").split("\n");

    }
}





/*----------------------render------------------*/

function Render(doc){
    this.container = $("#editor");
    this.text = $(".text");
    this.lineNum = $(".line-num");
    this.source =$(".source");
    this.hightlight = $(".hightlight");
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
    this.doc.onUpdateLine=function(value,row, cmd){

        self.renderLine(value, row, cmd);

    }
    this.on();
}

Render.prototype={
    on:function(){
        var self=this;
        var el = this.container;
        this.text.bind("select",function(ev){
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

            var offset = self.source.offset();
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
                var offset = self.source.offset();
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

        self.input.bind("cut", function(ev){
            
            })


        self.input.bind("keydown",function(ev){

            var keyCode = ev.keyCode;
            
            console.log(keyCode);

            var height = self.charSize.height,
            width  =self.charSize.width;
            // tab
            if(keyCode == 9){
                var cursor = self.doc.insert("    ", self.getRange().end)
                console.log(cursor)
                
                self.setCursorRowColumn(cursor.row,cursor.column);
                self.setRange(self.getCursorPosition(),self.getCursorPosition())
                ev.preventDefault();
            }
            //cut
            if(ev.ctrlKey&&keyCode == 88){
                if(self.hasRange(self.getRange())){
                    var value =self.getRangeValue();
                    
                    console.log(value)
                    if(value)  self.input.val(value)

                    self.input.select();
  
                    var position =  self.doc.remove(self.getRange());
                    self.setCursorRowColumn(position.row,position.column);
                    self.setRange(self.getCursorPosition(),self.getCursorPosition())
                }
               
                 
                 
                
            }
            //copy
            if(ev.ctrlKey&&keyCode == 67){
                if(self.hasRange(self.getRange())){
                    var value =self.getRangeValue();
                    
                    console.log(value)
                    if(value)  self.input.val(value)

                    self.input.select();
  
                 
                }

            }
            
            if(ev.ctrlKey&&keyCode ==90){
                var position =  self.doc.undo();
                if(position){
                    self.setCursorRowColumn(position.row,position.column);
                    self.setRange(self.getCursorPosition(),self.getCursorPosition())
                }
                ev.preventDefault();
            }
            if(ev.ctrlKey&&keyCode ==89){
                var position =  self.doc.redo();
                if(position){
                    self.setCursorRowColumn(position.row,position.column);
                    self.setRange(self.getCursorPosition(),self.getCursorPosition())
                }
                ev.preventDefault();
            }
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
        /*
                self.doc.breakLine({
                    column:self.cursorPosition.column,
                    row:self.cursorPosition.row
                });
                self.setCursorY(self.cursorPosition.y+height);
                self.setCursorX(0);
                self.setRange(self.getCursorPosition(),self.getCursorPosition())
                ev.preventDefault()
*/
        }
       


        })
        self.input.keyup(function(ev){
            
            self.input.select();
            
           
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


    renderLine:function(value, row, cmd){
        if(!value)value =""
        var self = this;
        var   escapeValue=escapeHTML(value)
        

        
        var lineNode;
      
        if(cmd == CMD_ADD){
           
            lineNode= $(".line:eq("+row+")",this.text)  ;
            

   
            var newLine =  $('<div class="line" style="height:'+this.charSize.height+'px"></div>');
            var num= $(".num",this.lineNum);
            var newNum = $('<div class="num" style="height:'+this.charSize.height+'px">'+(num.length+1)+'</div>');
            
            this.lineNum.append(newNum);
            
          
            if(lineNode.length != 0){
                newLine.insertBefore(lineNode);
            }
            else{
                this.text.append(newLine);
            }
            lineNode = newLine;
            lineNode.html(escapeValue);
            
        }


       
        if(cmd == CMD_UPDATE){
           
            lineNode= $(".line:eq("+row+")",this.text)  ;

            if(lineNode.length ==0){

   
                lineNode =  $('<div class="line" style="height:'+this.charSize.height+'px"></div>');
                var num= $(".num",this.lineNum);
                var newNum = $('<div class="num" style="height:'+this.charSize.height+'px">'+(num.length+1)+'</div>');
            
                this.lineNum.append(newNum);

                this.text.append(lineNode);
              
            }
            lineNode.html(escapeValue);
                
        }
        if(cmd == CMD_REMOVE){
           
            var num= $(".num",this.lineNum);
           
            num.eq(num.length-1).remove();
            
            lineNode= $(".line:eq("+row+")",this.text);
            
            
          
            lineNode.remove();
            
        }

        window.setTimeout(function(){
            try{
                self.hightLighter(value, row, cmd);
                var option ={
                    browser:false,
                    widget:false,
                    windows:false
                }
                var lint =JSLINT(self.doc.getValue(),option);
                 $("#report").html("");
                for(var i =0;i<JSLINT.errors.length;i++){
                    var e = JSLINT.errors[i];
                   
                    $("#report").html($("#report").html()+"<br>" +e.id+":"+JSLINT.errors[i].reason+" at :   line:"+e.line+" character:"+e.character)
                }
                
              //  $("#report").html(JSON.stringify(JSLINT.errors[0]))
                
                
            }catch(e){
                showError(e)
            }
            
        }, 0)
       
       
    /*
   
        if(!worker)worker =new Worker("assets/worker_tokens.js");
        worker.onmessage=function(e){
           console.log(e.data)
           self.worker(e.data, row, cmd);
        }
      
        worker.postMessage(value);
*/
         


    


    },
    hightLighter:function(value, row, cmd){
        
        this.hightlight = this.text 
        var temp = value;
        value="";
        var token= tokens(temp);
        token=token?token:[];
        for(var i=0;i<token.length;i++){
            if(token[i].type=="string")token[i].value ='"'+token[i].value+'"';
            if(token[i].type=="comment")token[i].value ='//'+token[i].value;

            value+='<span class='+token[i].type+'>'+escapeHTML(token[i].value)+'</span>'
        }


        var lineNode;

      
        if(cmd == CMD_UPDATE || cmd == CMD_ADD){
           
            lineNode= $(".line:eq("+row+")",this.hightlight)  ;

            if(lineNode.length ==0){


                lineNode =  $('<div class="line" style="height:'+this.charSize.height+'px"></div>');

                this.hightlight.append(lineNode);

            }
            lineNode.html(value);
            return;
        }
       




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

        measureNode.remove();

        return size;
    },
    setCursorY:function (y){
        y = y+ this.container.scrollTop();
        
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
    
        x = x+this.container.scrollLeft();
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
    getRangeValue:function(){
        var range = this.range;
        return this.doc.getRangeValue(range);
     
      
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