/*jslint white:true, nomen: true, plusplus: true */
/*global mx, define, require, browser, devel, console */
/*mendix */

// Required module list. Remove unnecessary modules, you can always get them back from the boilerplate.
require([
    'dojo/_base/declare', 'mxui/widget/_WidgetBase', 'dijit/_TemplatedMixin',
    'mxui/dom', 'dojo/dom', 'dojo/query', 'dojo/dom-prop', 'dojo/dom-geometry', 'dojo/dom-class', 'dojo/dom-style', 'dojo/dom-construct', 'dojo/_base/array', 'dojo/_base/lang', 'dojo/text',
    'dojo/_base/kernel', 'dojo/text!formatstring/widget/template/formatstring.html'
], function (declare, _WidgetBase, _TemplatedMixin, dom, dojoDom, domQuery, domProp, domGeom, domClass, domStyle, domConstruct, dojoArray, lang, text, dojo, widgetTemplate) {
    'use strict';

    // Declare widget's prototype.
    return declare('formatstring.widget.formatstring', [_WidgetBase, _TemplatedMixin], {
        // _TemplatedMixin will create our dom node using this HTML template.
        templateString: widgetTemplate,

        /**
         * Internal variables.
         * ======================
         */
        _wgtNode: null,
        _contextGuid: null,
        _contextObj: null,
        _handle: null,
        attributeList: null,
        /**
         * Mendix Widget methods.
         * ======================
         */

        constructor: function () {
           
        },

        // DOJO.WidgetBase -> PostCreate is fired after the properties of the widget are set.
        postCreate: function () {
            console.log('formatstring - postcreate');
            // Setup widgets
            this._setupWidget();

            // Setup events
            this._setupEvents();


            if (this._shouldRenderHtml()) {
                domClass.add(this._wgtNode, 'formatstring_widget');
            }

            if (this._shouldRenderHtml() && this.onclickmf !== '') {
                this.connect(this._wgtNode, "onclick", this.execmf);
            }
            
             this.attributeList = this.notused;
        },


        /**
         * What to do when data is loaded?
         */

        update: function (obj, callback) {
            console.log(this.id + '.update');

            this._contextObj = obj;
            this._resetSubscriptions();
            this._loadData();

            callback();
        },

        unintialize: function () {
            //TODO, clean up only events
            if (this._handle) {
                mx.data.unsubscribe(this._handle);
            }
        },


        /**
         * Extra setup widget methods.
         * ======================
         */
        _setupWidget: function () {

            // To be able to just alter one variable in the future we set an internal variable with the domNode that this widget uses.
            this._wgtNode = this.domNode;

        },


        // Attach events to newly created nodes.
        _setupEvents: function () {

            console.log('formatstring - setup events');


        },


        /**
         * Interaction widget methods.
         * ======================
         */
        _loadData: function () {
            this.replaceattributes = [];
            var referenceAttributeList = [],
                numberlist = [],
                i = null,
                value = null;

            for (i = 0; i < this.attributeList.length; i++) {
                if (this._contextObj.get(this.attributeList[i].attrs) !== null) {
                    value = this._fetchAttr(this._contextObj, this.attributeList[i].attrs, this.attributeList[i].renderHTML, i,
                        this.attributeList[i].emptyReplacement, this.attributeList[i].decimalPrecision, this.attributeList[i].groupDigits);
                    this.replaceattributes.push({
                        id: i,
                        variable: this.attributeList[i].variablename,
                        value: value
                    });
                } else {
                    //we'll jump through some hoops with this.
                    referenceAttributeList.push(this.attributeList[i]);
                    numberlist.push(i);
                }
            }

            if (referenceAttributeList.length > 0) {
                //if we have reference attributes, we need to fetch them. Asynchronicity FTW
                this._fetchReferences(referenceAttributeList, numberlist);
            } else {
                this._buildString();
            }
        },

        // The fetch referencse is an async action, we use dojo.hitch to create a function that has values of the scope of the for each loop we are in at that moment.
        _fetchReferences: function (list, numberlist) {
            var i = null,
                callbackfunction = null;


            callbackfunction = function (data, obj) {
                var value = this._fetchAttr(obj, data.split[2], data.renderAsHTML, data.oldnumber, data.emptyReplacement, data.decimalPrecision, data.groupDigits);
                this.replaceattributes.push({
                    id: data.i,
                    variable: data.listObj.variablename,
                    value: value
                });
                this._buildString();
            };

            for (i = 0; i < list.length; i++) {
                var listObj = list[i],
                    split = list[i].attrs.split('/'),
                    guid = this._contextObj.getReference(split[0]),
                    renderAsHTML = list[i].renderHTML,
                    emptyReplacement = list[i].emptyReplacement,
                    decimalPrecision = list[i].decimalPrecision,
                    groupDigits = list[i].groupDigits,
                    oldnumber = numberlist[i],
                    dataparam = {
                        i: i,
                        listObj: listObj,
                        split: split,
                        renderAsHTML: renderAsHTML,
                        oldnumber: oldnumber
                    };


                if (guid !== '') {
                    mx.data.get({
                        guid: guid,
                        callback: lang.hitch(this, callbackfunction, dataparam)
                    });
                } else {
                    //empty reference
                    this.replaceattributes.push({
                        id: i,
                        variable: listObj.variablename,
                        value: ''
                    });
                    this._buildString();
                }
            }
        },

        _fetchAttr: function (obj, attr, renderAsHTML, i, emptyReplacement, decimalPrecision, groupDigits) {
            var returnvalue = "",
                options = {},
                numberOptions = null;

            if (obj.isDate(attr)) {
                if (this.attributeList[i].datePattern !== '') {
                    options.datePattern = this.attributeList[i].datePattern;
                }
                if (this.attributeList[i].timePattern !== '') {
                    options.timePattern = this.attributeList[i].timePattern;
                }

                returnvalue = this._parseDate(this.attributeList[i].datetimeformat, options, obj.get(attr));
            } else if (obj.isEnum(attr)) {
                returnvalue = this._checkString(obj.getEnumCaption(attr, obj.get(attr)), renderAsHTML);

            } else if (obj.isNumeric(attr) || obj.isCurrency(attr)) {
                numberOptions = {};
                numberOptions.places = decimalPrecision;
                if (groupDigits) {
                    numberOptions.locale = dojo.locale;
                    numberOptions.groups = true;
                }

                returnvalue = mx.parser.formatValue(obj.get(attr), obj.getAttributeType(attr), numberOptions);
            } else {
                if (obj.getAttributeType(attr) === "String") {
                    returnvalue = this._checkString(mx.parser.formatAttribute(obj, attr), renderAsHTML);
                }
            }
            if (returnvalue === '') {
                return emptyReplacement;
            } else {
                return returnvalue;
            }
        },


        // _buildString also does _renderString because of callback from fetchReferences is async.
        _buildString: function (message) {
            var str = this.displaystr,
                settings = null,
                attr = null;

            for (attr in this.replaceattributes) {
                settings = this.replaceattributes[attr];
                str = str.split('${' + settings.variable + '}').join(settings.value);
            }

            this._renderString(str);
        },

        _renderString: function (msg) {
            var div = null;

            if (this._shouldRenderHtml()) {
                dojo.empty(this._wgtNode);
                div = dom.div({
                    'class': 'formatstring'
                });
                div.innerHTML = msg;
                this._wgtNode.appendChild(div);
            } else if (this._shouldRenderJs()) {

                try {
                    eval('Invalid javascript: ' + msg);
                } catch (err) {
                    div = dom.div({
                        'class': 'formatstring'
                    });
                    div.innerHTML = err.message;
                    this._wgtNode.appendChild(div);
                }
            } else {
                console.error("BUG: contenttype set to unknown value: " + this.contenttype);
            }
        },

        _checkString: function (string, renderAsHTML) {
            if (this._shouldRenderHtml() && (string.indexOf("<script") > -1 || !renderAsHTML)) {
                string = dom.escapeHTML(string);
            } else if (!this._shouldRenderHtml()) {
                string = encodeURIComponent(string);
            }
            return string;
        },

        _parseDate: function (format, options, value) {
            var datevalue = value;

            if (value === "") {
                return value;
            }

            if (format === 'relative') {
                return this._parseTimeAgo(value);
            } else {
                options.selector = format;

                datevalue = dojo.date.locale.format(new Date(value), options);
            }
            return datevalue;
        },

        _parseTimeAgo: function (value) {
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
                return nr + " " + (nr === 1 ? unitSingular : unitPlural) + " " + appendStr;
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
                return "a long time " + appendStr;
            }
        },

        execmf: function () {
            if (!this._contextObj) {
                return;
            }

            mx.data.action({
                params: {
                    actionname: this.onclickmf,
                    applyto: 'selection',
                    guids: [this._contextObj.getGuid()]
                },
                callback: function () {
                    // ok   
                },
                error: function () {
                    // error
                }

            });
        },

        _shouldRenderHtml: function () {
            return this.contenttype === 'html';
        },
        _shouldRenderJs: function () {
            return this.contenttype === 'js';
        },
        
        _resetSubscriptions: function () {
            // Release handle on previous object, if any.
            if (this._handle) {
                this.unsubscribe(this._handle);
                this._handle = null;
            }

            if (this._contextObj) {
                this._handle = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: this._loadData
                });
            }
        }
    });
});