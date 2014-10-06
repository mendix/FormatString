
dojo.provide("formatstring.widget.formatstring");

dojo.declare('formatstring.widget.formatstring', mxui.widget._WidgetBase, {
    
    _hasStarted         : false,
    _mxobj              : null,
    replaceattributes   : null,
    
    startup : function() {
        if (this._hasStarted)
            return;
        
        this.attributeList = this.notused;
        this._hasStarted = true;
        dojo.addClass(this.domNode, 'formatstring_widget');

        if (this.onclickmf !== '') 
            this.connect(this.domNode, "onclick", this.execmf);

        this.actLoaded();
    },

    update : function(obj, callback){
        dojo.empty(this.domNode);
        
        if (!obj){
            callback && callback();
            return;
        }
        
        this._mxobj = obj;

        this.subscribe({
            guid : obj.getGuid(),
            callback : this.getData
        });

        
        this.getData();

        callback && callback();
    },

    // We get data eighter by reference or by object.
    // The trick is to push an object in the array, containing information that can later on be used in the buildString function.
    getData : function() {
        this.replaceattributes = [];
        var referenceAttributeList = [];
        var numberlist = [];
        for (var i = 0; i  < this.attributeList.length; i++) {
            var value = null;
            if(this._mxobj.get(this.attributeList[i].attrs) !== null) {
                value = this.fetchAttr(this._mxobj, this.attributeList[i].attrs, this.attributeList[i].renderHTML, i, this.attributeList[i].emptyReplacement);
                this.replaceattributes.push({ id: i, variable: this.attributeList[i].variablename, value: value, emptyReplacement : this.attributeList[i].emptyReplacement});
            } else {
                //we'll jump through some hoops with this.
                referenceAttributeList.push(this.attributeList[i]);
                numberlist.push(i);
            }
        }
        
        if(referenceAttributeList.length > 0){
            //if we have reference attributes, we need to fetch them. Asynchronicity FTW
            this.fetchReferences(referenceAttributeList, numberlist);
        } else {
            this.buildString();
        }        
    },

    // The fetch referencse is an async action, we use dojo.hitch to create a function that has values of the scope of the for each loop we are in at that moment.
    fetchReferences : function(list, numberlist) {
        for(var i = 0; i < list.length; i++) {
            var self = this;
            var listContent = list;
            var listObj = list[i];
            var split = list[i].attrs.split('/');
            var guid = this._mxobj.getReference(split[0]);
            var htmlBool = list[i].renderHTML;
            var emptyReplacement = list[i].emptyReplacement;
            var oldnumber = numberlist[i];
            if(guid !== ''){
                mx.data.get({
                    guid : guid,
                    callback : dojo.hitch(this, function(data, obj) {
                        value = self.fetchAttr(obj, data.split[2], data.htmlBool, data.oldnumber);
                        self.replaceattributes.push({ id: data.i, variable: data.listObj.variablename, value: value, emptyReplacement : emptyReplacement });
                        self.buildString();
                    }, { i: i, listObj: listObj, split: split, htmlBool: htmlBool, oldnumber: oldnumber } )
                });
            } else {
                //empty reference
                value = '';
                self.replaceattributes.push({ id: i, variable: listObj.variablename, value: value});
                self.buildString();
            }
        }
    },

    fetchAttr : function(obj, attr, htmlBool, i, emptyReplacement) {
       var returnvalue = "";

        if(obj.isDate(attr))
        {
            returnvalue = this.parseDate(this.attributeList[i].datetimeformat, obj.get(attr));
        } 
        else if (obj.isEnum(attr))
        {
            returnvalue = this.checkString(obj.getEnumCaption(attr, obj.get(attr)), htmlBool);

        }
        else
        {
            returnvalue = mx.parser.formatAttribute(obj, attr, {places : this.decimalPrecision});

            if (obj.getAttributeType(attr) == "String") 
                returnvalue = this.checkString(returnvalue, htmlBool);   
           
        }
        if(returnvalue == '')
            return emptyReplacement;
        else
            return returnvalue;
    },


    // buildstring also does renderstring because of callback from fetchReferences is async.
    buildString : function(message){
        var str = this.displaystr;

        for (attr in this.replaceattributes) {
            var settings = this.replaceattributes[attr];
            this.displaystr = this.displaystr.split('\${' + settings.variable + '}').join(settings.value);
        }

        this.renderString(this.displaystr);
    },

    renderString : function(msg) {
        dojo.empty(this.domNode);
        var div = mxui.dom.div( { 'class': 'formatstring'});
        div.innerHTML = msg;
        this.domNode.appendChild(div);
    },

    checkString : function (string, htmlBool) {
        if(string.indexOf("<script") > -1 || !htmlBool)
            string = mxui.dom.escapeHTML(string);   
        return string;  
    },

    parseDate : function(format, value) {
        var datevalue = value;
        
        if(value=="")
            return value;
        
        if(format == 'relative')
            return this.parseTimeAgo(value);
        else
        {
            datevalue = dojo.date.locale.format(new Date(value), {
                selector : format
                });
        }
        return datevalue;
    },

    parseTimeAgo : function(value) {
        var date = new Date(value),
        now = new Date(),
        appendStr = (date > now) ? 'from now' : 'ago',
        diff = Math.abs(now.getTime() - date.getTime()),
        seconds = Math.floor(diff / 1000),
        minutes = Math.floor(seconds / 60),
        hours = Math.floor(minutes / 60),
        days = Math.floor(hours / 24),
        weeks = Math.floor(days / 7),
        months = Math.floor(days / 31),
        years = Math.floor(months / 12);
        
        function createTimeAgoString(nr, unitSingular, unitPlural) {
            return nr + " " + (nr === 1 ? unitSingular : unitPlural) + " "+appendStr;
        }
        
        if (seconds < 60) {
            return createTimeAgoString(seconds, "second", "seconds");
        } else if (minutes < 60) {
            return createTimeAgoString(minutes, "minute", "minutes");
        } else if (hours < 24) {
            return createTimeAgoString(hours, "hour", "hours");
        } else if (days < 7) {
            return createTimeAgoString(days, "day", "days");
        } else if (weeks < 5) {
            return createTimeAgoString(weeks, "week", "weeks");
        } else if (months < 12) {
            return createTimeAgoString(months, "month", "months");
        } else if (years < 10) {
            return createTimeAgoString(years, "year", "years");
        } else {
            return "a long time "+appendStr;
        }
    },

    execmf : function() {
        if(!this._mxobj)
            return;

        mx.data.action({
            params: {
                actionname  : this.onclickmf,
                applyto : 'selection',
                guids : [this._mxobj.getGuid()]
            },
            callback    : function() {
                // ok   
            },
            error       : function() {
                // error
            },

        });
    }
});