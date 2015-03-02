/*global mx, mxui, mendix, dojo, require, console, define, module */
/*mendix */
require([
	'dojo/_base/declare', 'mxui/widget/_WidgetBase', 'dijit/_TemplatedMixin',
	'mxui/dom', 'dojo/dom', 'dojo/query', 'dojo/dom-prop', 'dojo/dom-geometry', 'dojo/dom-class', 'dojo/dom-style', 'dojo/dom-construct', 'dojo/_base/array', 'dojo/_base/lang', 'dojo/text',
	'dojo/text!formatstring/widget/template/formatstring.html'
], function (declare, _WidgetBase, _TemplatedMixin, dom, dojoDom, domQuery, domProp, domGeom, domClass, domStyle, domConstruct, dojoArray, lang, text, widgetTemplate) {
	'use strict';

	// Declare widget.
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

		// Extra variables
		_hasStarted: false,

		/**
		 * Mendix Widget methods.
		 * ======================
		 */

		// DOJO.WidgetBase -> PostCreate is fired after the properties of the widget are set.
		postCreate: function () {
			console.log('formatstring - postcreate');
			// Setup widgets
			this._setupWidget();

			// Setup events
			this._setupEvents();

		},

		// DOJO.WidgetBase -> Startup is fired after the properties of the widget are set.
		startup: function () {
			console.log('formatstring - startup');
			if (this._hasStarted)
				return;

			this.attributeList = this.notused;
			this._hasStarted = true;

			if (this.shouldRenderHtml()) {
				dojo.addClass(this._wgtNode, 'formatstring_widget');
			}

			if (this.shouldRenderHtml() && this.onclickmf !== '')
				this.connect(this._wgtNode, "onclick", this.execmf);
		},

		/**
		 * What to do when data is loaded?
		 */

		update: function (obj, callback) {
			// startup
			console.log('formatstring - update');

			// Release handle on previous object, if any.
			if (this._handle) {
				mx.data.unsubscribe(this._handle);
			}

			if (typeof obj === 'string') {
				this._contextGuid = obj;
				mx.data.get({
					guids: [this._contextGuid],
					callback: dojo.hitch(this, function (objs) {

						// Set the object as background.
						this._contextObj = objs;

						// Load data again.
						this._loadData();

					})
				});
			} else {
				this._contextObj = obj;
			}

			if (obj === null) {
				// Sorry no data no show!
				console.log('formatstring  - update - We did not get any context object!');
			} else {

				// Load data
				this._loadData();

				// Subscribe to object updates.
				this._handle = mx.data.subscribe({
					guid: this._contextObj.getGuid(),
					callback: dojo.hitch(this, function (obj) {

						mx.data.get({
							guids: [obj],
							callback: dojo.hitch(this, function (objs) {

								// Set the object as background.
								this._contextObj = objs;

								// Load data again.
								this._loadData();

							})
						});

					})
				});
			}

			// Execute callback.
			if (typeof callback !== 'undefined') {
				callback();
			}
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

			this.connect(this._wgtNode, 'click', function () {

				mx.data.action({
					params: {
						applyto: 'selection',
						actionname: this.mfToExecute,
						guids: [this._contextObj.getGuid()]
					},
					callback: function (obj) {
						//TODO what to do when all is ok!
					},
					error: function (error) {
						console.log(error.description);
					}
				}, this);

			});

		},


		/**
		 * Interaction widget methods.
		 * ======================
		 */
		_loadData: function () {
			this.replaceattributes = [];
			var referenceAttributeList = [];
			var numberlist = [];
			for (var i = 0; i < this.attributeList.length; i++) {
				var value = null;
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
			var callbackfunction = function (data, obj) {
				var value = this._fetchAttr(obj, data.split[2], data.renderAsHTML, data.oldnumber, emptyReplacement, decimalPrecision, groupDigits);
				this.replaceattributes.push({
					id: data.i,
					variable: data.listObj.variablename,
					value: value
				});
				this._buildString();
			};

			for (var i = 0; i < list.length; i++) {
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
			var returnvalue = "";
			var options = {};

			if (obj.isDate(attr)) {
				if(this.attributeList[i].datePattern !== '') {
					options.datePattern = this.attributeList[i].datePattern;
				}
				if(this.attributeList[i].timePattern !== '') {
					options.timePattern = this.attributeList[i].timePattern;
				}
				
				returnvalue = this._parseDate(this.attributeList[i].datetimeformat, options, obj.get(attr));
			} else if (obj.isEnum(attr)) {
				returnvalue = this._checkString(obj.getEnumCaption(attr, obj.get(attr)), renderAsHTML);

			} else if (obj.isNumber(attr) || obj.isCurrency(attr)) {
				var numberOptions = {};
				numberOptions.places = decimalPrecision;
				if (groupDigits) {
					numberOptions.locale = dojo.locale;
					numberOptions.groups = true;
				}

				returnvalue = mx.parser.formatValue(obj.get(attr), obj.getAttributeType(attr), numberOptions);
			} else {
				if (obj.getAttributeType(attr) == "String")
					returnvalue = this._checkString(mx.parser.formatAttribute(obj, attr), renderAsHTML);
			}
			if (returnvalue === '')
				return emptyReplacement;
			else
				return returnvalue;
		},


		// _buildString also does _renderString because of callback from fetchReferences is async.
		_buildString: function (message) {
			var str = this.displaystr,
				settings = null;

			for (var attr in this.replaceattributes) {
				settings = this.replaceattributes[attr];
				str = str.split('${' + settings.variable + '}').join(settings.value);
			}

			this._renderString(str);
		},

		_renderString: function (msg) {
			if (this.shouldRenderHtml()) {
				dojo.empty(this._wgtNode);
				var div = mxui.dom.div({
					'class': 'formatstring'
				});
				div.innerHTML = msg;
				this._wgtNode.appendChild(div);
			} else if (this.shouldRenderJs()) {

				try {
					eval('Invalid javascript: ' + msg);
				} catch (err) {
					var div = mxui.dom.div({
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
			if (this.shouldRenderHtml() && (string.indexOf("<script") > -1 || !renderAsHTML)) {
				string = mxui.dom.escapeHTML(string);
			} else if (!this.shouldRenderHtml()) {
				string = encodeURIComponent(string);
			}
			return string;
		},

		_parseDate: function (format, options, value) {
			var datevalue = value;

			if (value === "")
				return value;

			if (format == 'relative')
				return this._parseTimeAgo(value);
			else {
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
			if (!this._contextObj)
				return;

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
				},

			});
		},

		shouldRenderHtml: function () {
			return this.contenttype === 'html';
		},
		shouldRenderJs: function () {
			return this.contenttype === 'js';
		}
	});
});