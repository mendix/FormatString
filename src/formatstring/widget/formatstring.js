define([
    "dojo/_base/declare",
    "mxui/widget/_WidgetBase",
    "mxui/dom",
    "dojo/_base/lang",
    "dojo/_base/kernel",
    "dojo/_base/array",
    "dojo/dom-class",
    "dojo/on",
    "formatstring/lib/timeLanguagePack"
], function(declare, _WidgetBase, dom, lang, dojo, dojoArray, domClass, on, languagePack) {
    "use strict";

    return declare("formatstring.widget.formatstring", [_WidgetBase], {

        _contextObj: null,
        _timeData: null,
        _replaceAttributes: null,
        attributeList: null,

        _timeStrings: {},

        postCreate: function() {
            logger.debug(this.id + ".postCreate");

            this._buildTimeStrings();
            this._timeData = languagePack;

            if (this.onclickmf) {
                this._setupEvents();
            }

            this.attributeList = this.notused;
        },

        _buildTimeStrings: function() {
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

        update: function(obj, callback) {
            logger.debug(this.id + ".update");
            this._contextObj = obj;
            this._resetSubscriptions();

            this._loadData(callback);
        },

        _setupEvents: function() {
            logger.debug(this.id + "._setupEvents, add onClick:" + this.onclickmf);
            on(this.domNode, "click", lang.hitch(this, function(e) {
                this.execmf();
                if (this.stopClickPropagation) {
                    e.stopPropagation();
                }
            }));
        },

        _getLocale: function () {
            if (this.localeSelection === "automatic") {
                return dojo.locale;
            }
            return this.localeSelection.replace("_", "-");
        },

        _loadData: function(callback) {
            logger.debug(this.id + "._loadData");
            this._replaceAttributes = [];

            if (!this._contextObj) {
                logger.debug(this.id + "._loadData empty context, hiding");
                domClass.toggle(this.domNode, "hidden", true);
                this._executeCallback(callback, "_loadData");
                return;
            }
            domClass.toggle(this.domNode, "hidden", false);

            this.collect(dojoArray.map(this.attributeList, lang.hitch(this, function (attrObj) {
                if (this._contextObj.get(attrObj.attrs) !== null) {
                    return function (cb) {
                        var value = this._fetchAttr(this._contextObj, attrObj.attrs, attrObj);

                        if (attrObj.variablename !== "") {
                            this._replaceAttributes.push({
                                variable: attrObj.variablename,
                                value: value
                            });
                        } else {
                            logger.warn(this.id + "._loadData: You have an empty variable name, skipping! Please check Data source -> Attributes -> Variable Name");
                        }
                        cb();
                    };
                } else {
                    return this._fetchReferenceCollector(attrObj);
                }
            })), function () {
                this._buildString(callback);
            });
        },

        _fetchReferencesCBFunc: function(data, cb, obj) {
            logger.debug(this.id + "._fetchReferences get callback");

            var value = this._fetchAttr(obj, data.split[2], data.attrObject);

            this._replaceAttributes.push({
                variable: data.attrObject.variablename,
                value: value
            });
            cb();
        },

        _fetchReferenceCollector: function(attrObj) {
            return function(cb) {
                var split = attrObj.attrs.split("/"),
                    guid = this._contextObj.getReference(split[0]);

                var dataparam = {
                    attrObject: attrObj,
                    split: split
                };

                if (guid !== "") {
                    mx.data.get({
                        guid: guid,
                        callback: lang.hitch(this, this._fetchReferencesCBFunc, dataparam, cb)
                    });
                } else {
                    //empty reference
                    this._replaceAttributes.push({
                        variable: attrObj.variablename,
                        value: ""
                    });
                    cb();
                }
            };
        },

        _fetchAttr: function(obj, attr, attrObj) {
            logger.debug(this.id + "._fetchAttr");

            // Referenced object might be empty, can"t fetch an attr on empty
            if (!obj) {
                return attrObj.emptyReplacement;
            }

            if (obj.isDate(attr)) {
                var options = {
                    datePattern: attrObj.datePattern !== "" ? attrObj.datePattern : undefined,
                    timePattern: attrObj.timePattern !== "" ? attrObj.timePattern : undefined
                };

                var returnDate = this._parseDate(attrObj.datetimeformat, options, obj.get(attr));

                return returnDate === "" ? attrObj.emptyReplacement : returnDate;
            }

            if (obj.isEnum(attr)) {
                var returnEnum = this._checkString(obj.getEnumCaption(attr, obj.get(attr)), attrObj.renderHTML);
                return returnEnum === "" ? attrObj.emptyReplacement : returnEnum;
            }

            if (obj.isNumeric(attr) || obj.isCurrency(attr) || obj.getAttributeType(attr) === "AutoNumber") {
                var numberOptions = {};
                numberOptions.places = attrObj.decimalPrecision;
                if (attrObj.groupDigits) {
                    numberOptions.locale = this._getLocale();
                    numberOptions.groups = true;
                }

                var returnNumber = mx.parser.formatValue(obj.get(attr), obj.getAttributeType(attr), numberOptions);
                return returnNumber === "" ? attrObj.emptyReplacement : returnNumber;
            }

            var returnValue = "";
            if (obj.getAttributeType(attr) === "String") {
                returnValue = this._checkString(mx.parser.formatAttribute(obj, attr), attrObj.renderHTML);
            }
            return returnValue === "" ? attrObj.emptyReplacement : returnValue;
        },

        // _buildString also does _renderString because of callback from fetchReferences is async.
        _buildString: function(callback) {
            logger.debug(this.id + "._buildString");
            var str = this.displaystr,
                classStr = this.classstr;

            dojoArray.forEach(this._replaceAttributes, lang.hitch(this, function (attr) {
                str = str.split("${" + attr.variable + "}").join(attr.value);
                classStr = classStr.split("${" + attr.variable + "}").join(attr.value);
            }));
            this._renderString(str, classStr, callback);
        },

        _renderString: function(msg, classStr, callback) {
            logger.debug(this.id + "._renderString");

            dojo.empty(this.domNode);
            var div = dom.create("div", {
                "class": "formatstring " + classStr
            });
            div.innerHTML = msg;
            this.domNode.appendChild(div);

            this._executeCallback(callback, "_renderString");
        },

        _checkString: function(string, renderAsHTML) {
            logger.debug(this.id + "._checkString");
            if (string.indexOf("<script") > -1 || !renderAsHTML) {
                string = dom.escapeString(string);
            }
            return string;
        },

        _parseDate: function(format, options, value) {
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

        _parseTimeAgo: function(value, data) {
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
            } else if (typeof this._timeData[this._getLocale()] !== "undefined") {
                time = this._timeData[this._getLocale()];
            } else {
                time = this._timeData["en-us"];
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

        execmf: function() {
            logger.debug(this.id + ".execmf");
            if (!this._contextObj) {
                return;
            }

            if (this.onclickmf) {
                var mfObject = {
                    params: {
                        actionname: this.onclickmf,
                        applyto: "selection",
                        guids: [this._contextObj.getGuid()]
                    },
                    error: function(error) {
                        logger.error(this.id + ": An error ocurred while executing microflow: ", error);
                    }
                };
                if (!mx.version || mx.version && parseInt(mx.version.split(".")[0]) < 7) {
                    // < Mendix 7
                    mfObject.store = {
                        caller: this.mxform
                    };
                } else {
                    mfObject.origin = this.mxform;
                }

                mx.data.action(mfObject, this);
            }
        },

        _resetSubscriptions: function() {
            logger.debug(this.id + "._resetSubscriptions");
            this.unsubscribeAll();

            if (this._contextObj) {
                this.subscribe({
                    guid: this._contextObj.getGuid(),
                    callback: this._loadData
                });

                for (var i = 0; i < this.attributeList.length; i++) {
                    this.subscribe({
                        guid: this._contextObj.getGuid(),
                        attr: this.attributeList[i].attrs,
                        callback: this._loadData
                    });
                }
            }
        },

        _executeCallback: function(cb, from) {
            logger.debug(this.id + "._executeCallback" + (from ? " from " + from : ""));
            if (cb && typeof cb === "function") {
                cb();
            }
        }
    });
});

require(["formatstring/widget/formatstring"]);
