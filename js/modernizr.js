/*! modernizr 3.11.2 (Custom Build) | MIT *
 * https://modernizr.com/download/?-arrow-borderradius-boxshadow-boxsizing-canvas-cssgrid_cssgridlegacy-csstransforms3d-csstransitions-es6array-es6collections-es6math-es6number-es6object-es6string-eventlistener-fileinput-filereader-flexbox-generators-indexeddb-input-json-localstorage-passiveeventlisteners-placeholder-promises-queryselector-scriptasync-todataurljpeg_todataurlpng_todataurlwebp-websockets-webworkers-setclasses !*/
!(function (scriptGlobalObject, window, document, undefined) {
	function is(e, t) {
		return typeof e === t;
	}
	function testRunner() {
		var e, t, r, n, o, i, s;
		for (var d in tests)
			if (tests.hasOwnProperty(d)) {
				if (
					((e = []),
					(t = tests[d]),
					t.name &&
						(e.push(t.name.toLowerCase()),
						t.options &&
							t.options.aliases &&
							t.options.aliases.length))
				)
					for (r = 0; r < t.options.aliases.length; r++)
						e.push(t.options.aliases[r].toLowerCase());
				for (
					n = is(t.fn, 'function') ? t.fn() : t.fn, o = 0;
					o < e.length;
					o++
				)
					(i = e[o]),
						(s = i.split('.')),
						1 === s.length
							? (Modernizr[s[0]] = n)
							: ((Modernizr[s[0]] &&
									(!Modernizr[s[0]] ||
										Modernizr[s[0]] instanceof Boolean)) ||
									(Modernizr[s[0]] = new Boolean(
										Modernizr[s[0]]
									)),
							  (Modernizr[s[0]][s[1]] = n)),
						classes.push((n ? '' : 'no-') + s.join('-'));
			}
	}
	function setClasses(e) {
		var t = docElement.className,
			r = Modernizr._config.classPrefix || '';
		if ((isSVG && (t = t.baseVal), Modernizr._config.enableJSClass)) {
			var n = new RegExp('(^|\\s)' + r + 'no-js(\\s|$)');
			t = t.replace(n, '$1' + r + 'js$2');
		}
		Modernizr._config.enableClasses &&
			(e.length > 0 && (t += ' ' + r + e.join(' ' + r)),
			isSVG
				? (docElement.className.baseVal = t)
				: (docElement.className = t));
	}
	function createElement() {
		return 'function' != typeof document.createElement
			? document.createElement(arguments[0])
			: isSVG
			? document.createElementNS.call(
					document,
					'http://www.w3.org/2000/svg',
					arguments[0]
			  )
			: document.createElement.apply(document, arguments);
	}
	function contains(e, t) {
		return !!~('' + e).indexOf(t);
	}
	function getBody() {
		var e = document.body;
		return (
			e || ((e = createElement(isSVG ? 'svg' : 'body')), (e.fake = !0)), e
		);
	}
	function injectElementWithStyles(e, t, r, n) {
		var o,
			i,
			s,
			d,
			a = 'modernizr',
			l = createElement('div'),
			c = getBody();
		if (parseInt(r, 10))
			for (; r--; )
				(s = createElement('div')),
					(s.id = n ? n[r] : a + (r + 1)),
					l.appendChild(s);
		return (
			(o = createElement('style')),
			(o.type = 'text/css'),
			(o.id = 's' + a),
			(c.fake ? c : l).appendChild(o),
			c.appendChild(l),
			o.styleSheet
				? (o.styleSheet.cssText = e)
				: o.appendChild(document.createTextNode(e)),
			(l.id = a),
			c.fake &&
				((c.style.background = ''),
				(c.style.overflow = 'hidden'),
				(d = docElement.style.overflow),
				(docElement.style.overflow = 'hidden'),
				docElement.appendChild(c)),
			(i = t(l, e)),
			c.fake
				? (c.parentNode.removeChild(c),
				  (docElement.style.overflow = d),
				  docElement.offsetHeight)
				: l.parentNode.removeChild(l),
			!!i
		);
	}
	function domToCSS(e) {
		return e
			.replace(/([A-Z])/g, function (e, t) {
				return '-' + t.toLowerCase();
			})
			.replace(/^ms-/, '-ms-');
	}
	function computedStyle(e, t, r) {
		var n;
		if ('getComputedStyle' in window) {
			n = getComputedStyle.call(window, e, t);
			var o = window.console;
			if (null !== n) r && (n = n.getPropertyValue(r));
			else if (o) {
				var i = o.error ? 'error' : 'log';
				o[i].call(
					o,
					'getComputedStyle returning null, its possible modernizr test results are inaccurate'
				);
			}
		} else n = !t && e.currentStyle && e.currentStyle[r];
		return n;
	}
	function nativeTestProps(e, t) {
		var r = e.length;
		if ('CSS' in window && 'supports' in window.CSS) {
			for (; r--; ) if (window.CSS.supports(domToCSS(e[r]), t)) return !0;
			return !1;
		}
		if ('CSSSupportsRule' in window) {
			for (var n = []; r--; )
				n.push('(' + domToCSS(e[r]) + ':' + t + ')');
			return (
				(n = n.join(' or ')),
				injectElementWithStyles(
					'@supports (' +
						n +
						') { #modernizr { position: absolute; } }',
					function (e) {
						return (
							'absolute' === computedStyle(e, null, 'position')
						);
					}
				)
			);
		}
		return undefined;
	}
	function cssToDOM(e) {
		return e
			.replace(/([a-z])-([a-z])/g, function (e, t, r) {
				return t + r.toUpperCase();
			})
			.replace(/^-/, '');
	}
	function testProps(e, t, r, n) {
		function o() {
			s && (delete mStyle.style, delete mStyle.modElem);
		}
		if (((n = !is(n, 'undefined') && n), !is(r, 'undefined'))) {
			var i = nativeTestProps(e, r);
			if (!is(i, 'undefined')) return i;
		}
		for (
			var s, d, a, l, c, u = ['modernizr', 'tspan', 'samp'];
			!mStyle.style && u.length;

		)
			(s = !0),
				(mStyle.modElem = createElement(u.shift())),
				(mStyle.style = mStyle.modElem.style);
		for (a = e.length, d = 0; d < a; d++)
			if (
				((l = e[d]),
				(c = mStyle.style[l]),
				contains(l, '-') && (l = cssToDOM(l)),
				mStyle.style[l] !== undefined)
			) {
				if (n || is(r, 'undefined')) return o(), 'pfx' !== t || l;
				try {
					mStyle.style[l] = r;
				} catch (e) {}
				if (mStyle.style[l] !== c) return o(), 'pfx' !== t || l;
			}
		return o(), !1;
	}
	function fnBind(e, t) {
		return function () {
			return e.apply(t, arguments);
		};
	}
	function testDOMProps(e, t, r) {
		var n;
		for (var o in e)
			if (e[o] in t)
				return !1 === r
					? e[o]
					: ((n = t[e[o]]),
					  is(n, 'function') ? fnBind(n, r || t) : n);
		return !1;
	}
	function testPropsAll(e, t, r, n, o) {
		var i = e.charAt(0).toUpperCase() + e.slice(1),
			s = (e + ' ' + cssomPrefixes.join(i + ' ') + i).split(' ');
		return is(t, 'string') || is(t, 'undefined')
			? testProps(s, t, n, o)
			: ((s = (e + ' ' + domPrefixes.join(i + ' ') + i).split(' ')),
			  testDOMProps(s, t, r));
	}
	function addTest(e, t) {
		if ('object' == typeof e)
			for (var r in e) hasOwnProp(e, r) && addTest(r, e[r]);
		else {
			e = e.toLowerCase();
			var n = e.split('.'),
				o = Modernizr[n[0]];
			if ((2 === n.length && (o = o[n[1]]), void 0 !== o))
				return Modernizr;
			(t = 'function' == typeof t ? t() : t),
				1 === n.length
					? (Modernizr[n[0]] = t)
					: (!Modernizr[n[0]] ||
							Modernizr[n[0]] instanceof Boolean ||
							(Modernizr[n[0]] = new Boolean(Modernizr[n[0]])),
					  (Modernizr[n[0]][n[1]] = t)),
				setClasses([(t && !1 !== t ? '' : 'no-') + n.join('-')]),
				Modernizr._trigger(e, t);
		}
		return Modernizr;
	}
	function detectDeleteDatabase(e, t) {
		var r = e.deleteDatabase(t);
		(r.onsuccess = function () {
			addTest('indexeddb.deletedatabase', !0);
		}),
			(r.onerror = function () {
				addTest('indexeddb.deletedatabase', !1);
			});
	}
	function testAllProps(e, t, r) {
		return testPropsAll(e, undefined, undefined, t, r);
	}
	var tests = [],
		ModernizrProto = {
			_version: '3.11.2',
			_config: {
				classPrefix: '',
				enableClasses: !0,
				enableJSClass: !0,
				usePrefixes: !0,
			},
			_q: [],
			on: function (e, t) {
				var r = this;
				setTimeout(function () {
					t(r[e]);
				}, 0);
			},
			addTest: function (e, t, r) {
				tests.push({name: e, fn: t, options: r});
			},
			addAsyncTest: function (e) {
				tests.push({name: null, fn: e});
			},
		},
		Modernizr = function () {};
	(Modernizr.prototype = ModernizrProto), (Modernizr = new Modernizr());
	var classes = [],
		docElement = document.documentElement,
		isSVG = 'svg' === docElement.nodeName.toLowerCase();
	Modernizr.addTest('canvas', function () {
		var e = createElement('canvas');
		return !(!e.getContext || !e.getContext('2d'));
	}),
		Modernizr.addTest('eventlistener', 'addEventListener' in window);
	var omPrefixes = 'Moz O ms Webkit',
		cssomPrefixes = ModernizrProto._config.usePrefixes
			? omPrefixes.split(' ')
			: [];
	ModernizrProto._cssomPrefixes = cssomPrefixes;
	var modElem = {elem: createElement('modernizr')};
	Modernizr._q.push(function () {
		delete modElem.elem;
	});
	var mStyle = {style: modElem.elem.style};
	Modernizr._q.unshift(function () {
		delete mStyle.style;
	});
	var domPrefixes = ModernizrProto._config.usePrefixes
		? omPrefixes.toLowerCase().split(' ')
		: [];
	(ModernizrProto._domPrefixes = domPrefixes),
		(ModernizrProto.testAllProps = testPropsAll);
	var atRule = function (e) {
		var t,
			r = prefixes.length,
			n = window.CSSRule;
		if (void 0 === n) return undefined;
		if (!e) return !1;
		if (
			((e = e.replace(/^@/, '')),
			(t = e.replace(/-/g, '_').toUpperCase() + '_RULE') in n)
		)
			return '@' + e;
		for (var o = 0; o < r; o++) {
			var i = prefixes[o];
			if (i.toUpperCase() + '_' + t in n)
				return '@-' + i.toLowerCase() + '-' + e;
		}
		return !1;
	};
	ModernizrProto.atRule = atRule;
	var prefixed = (ModernizrProto.prefixed = function (e, t, r) {
			return 0 === e.indexOf('@')
				? atRule(e)
				: (-1 !== e.indexOf('-') && (e = cssToDOM(e)),
				  t ? testPropsAll(e, t, r) : testPropsAll(e, 'pfx'));
		}),
		hasOwnProp;
	!(function () {
		var e = {}.hasOwnProperty;
		hasOwnProp =
			is(e, 'undefined') || is(e.call, 'undefined')
				? function (e, t) {
						return (
							t in e &&
							is(e.constructor.prototype[t], 'undefined')
						);
				  }
				: function (t, r) {
						return e.call(t, r);
				  };
	})(),
		(ModernizrProto._l = {}),
		(ModernizrProto.on = function (e, t) {
			this._l[e] || (this._l[e] = []),
				this._l[e].push(t),
				Modernizr.hasOwnProperty(e) &&
					setTimeout(function () {
						Modernizr._trigger(e, Modernizr[e]);
					}, 0);
		}),
		(ModernizrProto._trigger = function (e, t) {
			if (this._l[e]) {
				var r = this._l[e];
				setTimeout(function () {
					var e;
					for (e = 0; e < r.length; e++) (0, r[e])(t);
				}, 0),
					delete this._l[e];
			}
		}),
		Modernizr._q.push(function () {
			ModernizrProto.addTest = addTest;
		}),
		Modernizr.addAsyncTest(function () {
			var e;
			try {
				e = prefixed('indexedDB', window);
			} catch (e) {}
			if (e) {
				var t,
					r = 'modernizr-' + Math.random();
				try {
					t = e.open(r);
				} catch (e) {
					return void addTest('indexeddb', !1);
				}
				(t.onerror = function (n) {
					!t.error ||
					('InvalidStateError' !== t.error.name &&
						'UnknownError' !== t.error.name)
						? (addTest('indexeddb', !0), detectDeleteDatabase(e, r))
						: (addTest('indexeddb', !1), n.preventDefault());
				}),
					(t.onsuccess = function () {
						addTest('indexeddb', !0), detectDeleteDatabase(e, r);
					});
			} else addTest('indexeddb', !1);
		});
	var inputElem = createElement('input'),
		inputattrs = 'autocomplete autofocus list placeholder max min multiple pattern required step'.split(
			' '
		),
		attrs = {};
	(Modernizr.input = (function (e) {
		for (var t = 0, r = e.length; t < r; t++)
			attrs[e[t]] = !!(e[t] in inputElem);
		return (
			attrs.list &&
				(attrs.list = !(
					!createElement('datalist') || !window.HTMLDataListElement
				)),
			attrs
		);
	})(inputattrs)),
		Modernizr.addTest(
			'json',
			'JSON' in window && 'parse' in JSON && 'stringify' in JSON
		),
		Modernizr.addTest(
			'queryselector',
			'querySelector' in document && 'querySelectorAll' in document
		);
	var supports = !1;
	try {
		supports = 'WebSocket' in window && 2 === window.WebSocket.CLOSING;
	} catch (e) {}
	Modernizr.addTest('websockets', supports);
	var canvas = createElement('canvas');
	Modernizr.addTest('todataurljpeg', function () {
		var e = !1;
		try {
			e =
				!!Modernizr.canvas &&
				0 === canvas.toDataURL('image/jpeg').indexOf('data:image/jpeg');
		} catch (e) {}
		return e;
	}),
		Modernizr.addTest('todataurlpng', function () {
			var e = !1;
			try {
				e =
					!!Modernizr.canvas &&
					0 ===
						canvas.toDataURL('image/png').indexOf('data:image/png');
			} catch (e) {}
			return e;
		}),
		Modernizr.addTest('todataurlwebp', function () {
			var e = !1;
			try {
				e =
					!!Modernizr.canvas &&
					0 ===
						canvas
							.toDataURL('image/webp')
							.indexOf('data:image/webp');
			} catch (e) {}
			return e;
		}),
		(ModernizrProto.testAllProps = testAllProps),
		Modernizr.addTest(
			'borderradius',
			testAllProps('borderRadius', '0px', !0)
		),
		Modernizr.addTest(
			'boxshadow',
			testAllProps('boxShadow', '1px 1px', !0)
		),
		Modernizr.addTest(
			'boxsizing',
			testAllProps('boxSizing', 'border-box', !0) &&
				(document.documentMode === undefined ||
					document.documentMode > 7)
		),
		Modernizr.addTest(
			'cssgridlegacy',
			testAllProps('grid-columns', '10px', !0)
		),
		Modernizr.addTest(
			'cssgrid',
			testAllProps('grid-template-rows', 'none', !0)
		),
		Modernizr.addTest('flexbox', testAllProps('flexBasis', '1px', !0));
	var newSyntax = 'CSS' in window && 'supports' in window.CSS,
		oldSyntax = 'supportsCSS' in window;
	Modernizr.addTest('supports', newSyntax || oldSyntax),
		Modernizr.addTest('csstransforms3d', function () {
			return !!testAllProps('perspective', '1px', !0);
		}),
		Modernizr.addTest(
			'csstransitions',
			testAllProps('transition', 'all', !0)
		),
		Modernizr.addTest('passiveeventlisteners', function () {
			var e = !1;
			try {
				var t = Object.defineProperty({}, 'passive', {
						get: function () {
							e = !0;
						},
					}),
					r = function () {};
				window.addEventListener('testPassiveEventSupport', r, t),
					window.removeEventListener('testPassiveEventSupport', r, t);
			} catch (e) {}
			return e;
		}),
		Modernizr.addTest(
			'es6array',
			!!(
				Array.prototype &&
				Array.prototype.copyWithin &&
				Array.prototype.fill &&
				Array.prototype.find &&
				Array.prototype.findIndex &&
				Array.prototype.keys &&
				Array.prototype.entries &&
				Array.prototype.values &&
				Array.from &&
				Array.of
			)
		),
		Modernizr.addTest('arrow', function () {
			try {
				eval('()=>{}');
			} catch (e) {
				return !1;
			}
			return !0;
		}),
		Modernizr.addTest(
			'es6collections',
			!!(window.Map && window.Set && window.WeakMap && window.WeakSet)
		),
		Modernizr.addTest('generators', function () {
			try {
				new Function('function* test() {}')();
			} catch (e) {
				return !1;
			}
			return !0;
		}),
		Modernizr.addTest(
			'es6math',
			!!(
				Math &&
				Math.clz32 &&
				Math.cbrt &&
				Math.imul &&
				Math.sign &&
				Math.log10 &&
				Math.log2 &&
				Math.log1p &&
				Math.expm1 &&
				Math.cosh &&
				Math.sinh &&
				Math.tanh &&
				Math.acosh &&
				Math.asinh &&
				Math.atanh &&
				Math.hypot &&
				Math.trunc &&
				Math.fround
			)
		),
		Modernizr.addTest(
			'es6number',
			!!(
				Number.isFinite &&
				Number.isInteger &&
				Number.isSafeInteger &&
				Number.isNaN &&
				Number.parseInt &&
				Number.parseFloat &&
				Number.isInteger(Number.MAX_SAFE_INTEGER) &&
				Number.isInteger(Number.MIN_SAFE_INTEGER) &&
				Number.isFinite(Number.EPSILON)
			)
		),
		Modernizr.addTest(
			'es6object',
			!!(Object.assign && Object.is && Object.setPrototypeOf)
		),
		Modernizr.addTest('promises', function () {
			return (
				'Promise' in window &&
				'resolve' in window.Promise &&
				'reject' in window.Promise &&
				'all' in window.Promise &&
				'race' in window.Promise &&
				(function () {
					var e;
					return (
						new window.Promise(function (t) {
							e = t;
						}),
						'function' == typeof e
					);
				})()
			);
		}),
		Modernizr.addTest(
			'es6string',
			!!(
				String.fromCodePoint &&
				String.raw &&
				String.prototype.codePointAt &&
				String.prototype.repeat &&
				String.prototype.startsWith &&
				String.prototype.endsWith &&
				String.prototype.includes
			)
		),
		Modernizr.addTest(
			'filereader',
			!!(window.File && window.FileList && window.FileReader)
		),
		Modernizr.addTest('fileinput', function () {
			var e = navigator.userAgent;
			if (
				e.match(
					/(Android (1.0|1.1|1.5|1.6|2.0|2.1))|(Windows Phone (OS 7|8.0))|(XBLWP)|(ZuneWP)|(w(eb)?OSBrowser)|(webOS)|(Kindle\/(1.0|2.0|2.5|3.0))/
				) ||
				e.match(/\swv\).+(chrome)\/([\w\.]+)/i)
			)
				return !1;
			var t = createElement('input');
			return (t.type = 'file'), !t.disabled;
		}),
		Modernizr.addTest(
			'placeholder',
			'placeholder' in createElement('input') &&
				'placeholder' in createElement('textarea')
		),
		Modernizr.addTest('scriptasync', 'async' in createElement('script')),
		Modernizr.addTest('localstorage', function () {
			var e = 'modernizr';
			try {
				return (
					localStorage.setItem(e, e), localStorage.removeItem(e), !0
				);
			} catch (e) {
				return !1;
			}
		}),
		Modernizr.addTest('webworkers', 'Worker' in window),
		testRunner(),
		setClasses(classes),
		delete ModernizrProto.addTest,
		delete ModernizrProto.addAsyncTest;
	for (var i = 0; i < Modernizr._q.length; i++) Modernizr._q[i]();
	scriptGlobalObject.Modernizr = Modernizr;
})(window, window, document);
