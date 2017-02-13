define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "dijit/_TemplatedMixin",
    "mxui/dom",
    "dojo/dom",
    "dojo/dom-class",
    "dojo/_base/lang",
    "dojo/on",
    "dojo/text",
    "dojo/json",
    "dojo/_base/kernel",
    "dojo/_base/xhr",
    "formatstring/lib/timeLanguagePack",
    "dojo/text!formatstring/widget/template/formatstring.html"
], function (declare, _WidgetBase, _TemplatedMixin, dom, dojoDom, domClass, lang, on, text, json, dojo, xhr, languagePack, widgetTemplate) {
    "use strict";

    return declare("formatstring.widget.formatstring", [_WidgetBase, _TemplatedMixin], {
        templateString: widgetTemplate,

        _wgtNode: null,
        _contextGuid: null,
        _contextObj: null,
        _handles: [],
        _timeData: null,
        attributeList: null,

        _timeStrings: {},

        postCreate: function () {
            logger.debug(this.id + ".postCreate");

            this._buildTimeStrings();
            this._timeData = languagePack;
            this._setupEvents();
            this.attributeList = this.notused;
        },

        _buildTimeStrings: function () {
            this._timeStrings = {
                "second": this.translateStringsecond,
                "seconds": this.translateStringseconds,
                "minute": this.translateStringminute,
                "minutes": this.translateStringminutes,
                "hour": this.translateStringhour,
                "hours": this.translateStringhours,
                "day": this.translateStringday,
                "days": this.translateStringdays,
                "week": this.translateStringweek,
                "weeks": this.translateStringweeks,
                "month": this.translateStringmonth,
                "months": this.translateStringmonths,
                "year": this.translateStringyear,
                "years": this.translateStringyears,
                "timestampFuture": this.translateStringtimestampFuture,
                "timestampPast": this.translateStringtimestampPast
            };
        },

        update: function (obj, callback) {
            logger.debug(this.id + ".update");
            this._contextObj = obj;
            this._resetSubscriptions();

            this._loadData(callback);
        },

        _setupEvents: function () {
            logger.debug(this.id + "._setupEvents, add onClick:" + this.onclickmf);
            if (this.onclickmf) {
                on(this.domNode, "click", lang.hitch(this, function(e) {
                    this.execmf();

                    e.stopPropagation();
                }));
            }
        },

        _loadData: function (callback) {
            logger.debug(this.id + "._loadData");
            this.replaceattributes = [];
            var referenceAttributeList = [],
                numberlist = [],
                i = null,
                value = null;

            if (!this._contextObj) {
                logger.debug(this.id + "._loadData empty context, hiding");
                domClass.toggle(this.domNode, "hidden", true);
                this._executeCallback(callback, "_loadData");
                return;
            }
            domClass.toggle(this.domNode, "hidden", false);

            for (i = 0; i < this.attributeList.length; i++) {
                if (this._contextObj.get(this.attributeList[i].attrs) !== null) {
                    value = this._fetchAttr(this._contextObj, this.attributeList[i].attrs, this.attributeList[i].renderHTML, i,
                        this.attributeList[i].emptyReplacement, this.attributeList[i].decimalPrecision, this.attributeList[i].groupDigits);
                    if (this.attributeList[i].variablename !== "") {
                      this.replaceattributes.push({
                          id: i,
                          variable: this.attributeList[i].variablename,
                          value: value
                      });
                    } else {
                      logger.warn(this.id + "._loadData: You have an empty variable name, skipping! Please check Data source -> Attributes -> Variable Name");
                    }
                } else {
                    referenceAttributeList.push(this.attributeList[i]);
                    numberlist.push(i);
                }
            }

            if (referenceAttributeList.length > 0) {
                //if we have reference attributes, we need to fetch them
                this._fetchReferences(referenceAttributeList, numberlist, callback);
            } else {
                this._buildString(callback);
            }
        },

        // The fetch referencse is an async action, we use dojo.hitch to create a function that has values of the scope of the for each loop we are in at that moment.
        _fetchReferences: function (list, numberlist, callback) {
            logger.debug(this.id + "._fetchReferences");

            var l = list.length;

            var callbackfunction = function (data, obj) {
                logger.debug(this.id + "._fetchReferences get callback");
                var value = this._fetchAttr(obj, data.split[2], data.renderAsHTML, data.oldnumber, data.emptyReplacement, data.decimalPrecision, data.groupDigits);
                this.replaceattributes.push({
                    id: data.i,
                    variable: data.listObj.variablename,
                    value: value
                });

                l--;
                if (l <= 0) {
                    this._buildString(callback);
                } else {
                    this._buildString();
                }
            };

            for (var i = 0; i < list.length; i++) {
                var listObj = list[i],
                    split = list[i].attrs.split("/"),
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
                        emptyReplacement: emptyReplacement,
                        decimalPrecision: decimalPrecision,
                        groupDigits: groupDigits,
                        oldnumber: oldnumber
                    };


                if (guid !== "") {
                    mx.data.get({
                        guid: guid,
                        callback: lang.hitch(this, callbackfunction, dataparam)
                    });
                } else {
                    //empty reference
                    this.replaceattributes.push({
                        id: i,
                        variable: listObj.variablename,
                        value: ""
                    });
                    this._buildString(callback);
                }
            }
        },

        _fetchAttr: function (obj, attr, renderAsHTML, i, emptyReplacement, decimalPrecision, groupDigits) {
            logger.debug(this.id + "._fetchAttr");
            var returnvalue = "",
                options = {},
                numberOptions = null;

             // Referenced object might be empty, can"t fetch an attr on empty
            if (!obj) {
                return emptyReplacement;
            }

            if (obj.isDate(attr)) {
                if (this.attributeList[i].datePattern !== "") {
                    options.datePattern = this.attributeList[i].datePattern;
                }
                if (this.attributeList[i].timePattern !== "") {
                    options.timePattern = this.attributeList[i].timePattern;
                }
                returnvalue = this._parseDate(this.attributeList[i].datetimeformat, options, obj.get(attr));
            } else if (obj.isEnum(attr)) {
                returnvalue = this._checkString(obj.getEnumCaption(attr, obj.get(attr)), renderAsHTML);

            } else if (obj.isNumeric(attr) || obj.isCurrency(attr) || obj.getAttributeType(attr) === "AutoNumber") {
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
            if (returnvalue === "") {
                return emptyReplacement;
            } else {
                return returnvalue;
            }
        },

        // _buildString also does _renderString because of callback from fetchReferences is async.
        _buildString: function (callback) {
            logger.debug(this.id + "._buildString");
            var str = this.displaystr,
                classStr = this.classstr,
                settings = null,
                attr = null;

            for (attr in this.replaceattributes) {
                settings = this.replaceattributes[attr];
                str = str.split("${" + settings.variable + "}").join(settings.value);
                classStr = classStr.split("${" + settings.variable + "}").join(settings.value);
            }
            this._renderString(str, classStr, callback);
        },

        _renderString: function (msg, classStr, callback) {
            logger.debug(this.id + "._renderString");

            dojo.empty(this.domNode);
            var div = dom.create("div", {
                "class": "formatstring " + classStr
            });
            div.innerHTML = msg;
            this.domNode.appendChild(div);

            this._executeCallback(callback, "_renderString");
        },

        _checkString: function (string, renderAsHTML) {
            logger.debug(this.id + "._checkString");
            if (string.indexOf("<script") > -1 || !renderAsHTML) {
                string = dom.escapeString(string);
            }
            return string;
        },

        _parseDate: function (format, options, value) {
            logger.debug(this.id + "._parseDate");
            var datevalue = value;

            if (value === "") {
                return value;
            }

            if (format === "relative") {
                return this._parseTimeAgo(value);
            } else {
                options.selector = format;
                datevalue = dojo.date.locale.format(new Date(value), options);
            }
            return datevalue;
        },

        _parseTimeAgo: function (value, data) {
            logger.debug(this.id + "._parseTimeAgo");
            var date = new Date(value),
                now = new Date(),
                appendStr = null,
                diff = Math.abs(now.getTime() - date.getTime()),
                seconds = Math.floor(diff / 1000),
                minutes = Math.floor(seconds / 60),
                hours = Math.floor(minutes / 60),
                days = Math.floor(hours / 24),
                weeks = Math.floor(days / 7),
                months = Math.floor(days / 31),
                years = Math.floor(months / 12),
                time = null;

            if (this.useTranslatableStrings) {
                time = this._timeStrings;
            } else {
                time = this._timeData[dojo.locale];
            }

            appendStr = (date > now) ? time.timestampFuture : time.timestampPast;

            function createTimeAgoString(nr, unitSingular, unitPlural) {
                return nr + " " + (nr === 1 ? unitSingular : unitPlural) + " " + appendStr;
            }

            if (seconds < 60) {
                return createTimeAgoString(seconds, time.second, time.seconds);
            } else if (minutes < 60) {
                return createTimeAgoString(minutes, time.minute, time.minutes);
            } else if (hours < 24) {
                return createTimeAgoString(hours, time.hour, time.hours);
            } else if (days < 7) {
                return createTimeAgoString(days, time.day, time.days);
            } else if (weeks < 5) {
                return createTimeAgoString(weeks, time.week, time.weeks);
            } else if (months < 12) {
                return createTimeAgoString(months, time.month, time.months);
            } else if (years < 10) {
                return createTimeAgoString(years, time.year, time.years);
            } else {
                return "a long time " + appendStr;
            }
        },

        execmf: function () {
            logger.debug(this.id + ".execmf");
            if (!this._contextObj) {
                return;
            }

            if (this.onclickmf) {
                mx.data.action({
                    store: {
                       caller: this.mxform
                    },
                    params: {
                        actionname: this.onclickmf,
                        applyto: "selection",
                        guids: [this._contextObj.getGuid()]
                    },
                    callback: function () {},
                    error: function () {}
                });
            }
        },

        _resetSubscriptions: function () {
            logger.debug(this.id + "._resetSubscriptions");
            // Release handle on previous object, if any.
            var i = 0;

            for (i = 0; i < this._handles.length; i++) {
                if (this._handles[i]) {
                    this.unsubscribe(this._handles[i]);
                    this._handles[i] = null;
                }
            }

            if (this._contextObj) {
                this._handles[0] = this.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: this._loadData
                });

                for (i = 0; i < this.attributeList.length; i++) {
                    this._handles[i + 1] = this.subscribe({
                        guid: this._contextObj.getGuid(),
                        attr: this.attributeList[i].attrs,
                        callback: this._loadData
                    });

                }
            }
        },

        _executeCallback: function (cb, from) {
          logger.debug(this.id + "._executeCallback" + (from ? " from " + from : ""));
          if (cb && typeof cb === "function") {
            cb();
          }
        }
    });
});

require(["formatstring/widget/formatstring"]);
