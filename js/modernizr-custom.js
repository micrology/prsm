/*! modernizr 3.6.0 (Custom Build) | MIT *
 * https://modernizr.com/download/?-arrow-borderradius-boxshadow-boxsizing-canvas-cssgrid_cssgridlegacy-csstransforms3d-csstransitions-es6array-es6collections-es6math-es6number-es6object-es6string-eventlistener-fileinput-filereader-flexbox-generators-indexeddb-input-json-localstorage-passiveeventlisteners-placeholder-promises-queryselector-scriptasync-todataurljpeg_todataurlpng_todataurlwebp-websockets-webworkers-setclasses !*/
!(function (window, document, undefined) {
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
							: (!Modernizr[s[0]] ||
									Modernizr[s[0]] instanceof Boolean ||
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
			((t += ' ' + r + e.join(' ' + r)),
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
	function cssToDOM(e) {
		return e
			.replace(/([a-z])-([a-z])/g, function (e, t, r) {
				return t + r.toUpperCase();
			})
			.replace(/^-/, '');
	}
	function addTest(e, t) {
		if ('object' == typeof e)
			for (var r in e) hasOwnProp(e, r) && addTest(r, e[r]);
		else {
			e = e.toLowerCase();
			var n = e.split('.'),
				o = Modernizr[n[0]];
			if ((2 == n.length && (o = o[n[1]]), 'undefined' != typeof o))
				return Modernizr;
			(t = 'function' == typeof t ? t() : t),
				1 == n.length
					? (Modernizr[n[0]] = t)
					: (!Modernizr[n[0]] ||
							Modernizr[n[0]] instanceof Boolean ||
							(Modernizr[n[0]] = new Boolean(Modernizr[n[0]])),
					  (Modernizr[n[0]][n[1]] = t)),
				setClasses([(t && 0 != t ? '' : 'no-') + n.join('-')]),
				Modernizr._trigger(e, t);
		}
		return Modernizr;
	}
	function contains(e, t) {
		return !!~('' + e).indexOf(t);
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
				return r === !1
					? e[o]
					: ((n = t[e[o]]),
					  is(n, 'function') ? fnBind(n, r || t) : n);
		return !1;
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
			u = getBody();
		if (parseInt(r, 10))
			for (; r--; )
				(s = createElement('div')),
					(s.id = n ? n[r] : a + (r + 1)),
					l.appendChild(s);
		return (
			(o = createElement('style')),
			(o.type = 'text/css'),
			(o.id = 's' + a),
			(u.fake ? u : l).appendChild(o),
			u.appendChild(l),
			o.styleSheet
				? (o.styleSheet.cssText = e)
				: o.appendChild(document.createTextNode(e)),
			(l.id = a),
			u.fake &&
				((u.style.background = ''),
				(u.style.overflow = 'hidden'),
				(d = docElement.style.overflow),
				(docElement.style.overflow = 'hidden'),
				docElement.appendChild(u)),
			(i = t(l, e)),
			u.fake
				? (u.parentNode.removeChild(u),
				  (docElement.style.overflow = d),
				  docElement.offsetHeight)
				: l.parentNode.removeChild(l),
			!!i
		);
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
						return 'absolute' == computedStyle(e, null, 'position');
					}
				)
			);
		}
		return undefined;
	}
	function testProps(e, t, r, n) {
		function o() {
			s && (delete mStyle.style, delete mStyle.modElem);
		}
		if (((n = is(n, 'undefined') ? !1 : n), !is(r, 'undefined'))) {
			var i = nativeTestProps(e, r);
			if (!is(i, 'undefined')) return i;
		}
		for (
			var s, d, a, l, u, c = ['modernizr', 'tspan', 'samp'];
			!mStyle.style && c.length;

		)
			(s = !0),
				(mStyle.modElem = createElement(c.shift())),
				(mStyle.style = mStyle.modElem.style);
		for (a = e.length, d = 0; a > d; d++)
			if (
				((l = e[d]),
				(u = mStyle.style[l]),
				contains(l, '-') && (l = cssToDOM(l)),
				mStyle.style[l] !== undefined)
			) {
				if (n || is(r, 'undefined')) return o(), 'pfx' == t ? l : !0;
				try {
					mStyle.style[l] = r;
				} catch (p) {}
				if (mStyle.style[l] != u) return o(), 'pfx' == t ? l : !0;
			}
		return o(), !1;
	}
	function testPropsAll(e, t, r, n, o) {
		var i = e.charAt(0).toUpperCase() + e.slice(1),
			s = (e + ' ' + cssomPrefixes.join(i + ' ') + i).split(' ');
		return is(t, 'string') || is(t, 'undefined')
			? testProps(s, t, n, o)
			: ((s = (e + ' ' + domPrefixes.join(i + ' ') + i).split(' ')),
			  testDOMProps(s, t, r));
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
	var classes = [],
		tests = [],
		ModernizrProto = {
			_version: '3.6.0',
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
	(Modernizr.prototype = ModernizrProto),
		(Modernizr = new Modernizr()),
		Modernizr.addTest('eventlistener', 'addEventListener' in window),
		Modernizr.addTest(
			'json',
			'JSON' in window && 'parse' in JSON && 'stringify' in JSON
		),
		Modernizr.addTest(
			'queryselector',
			'querySelector' in document && 'querySelectorAll' in document
		),
		Modernizr.addTest('passiveeventlisteners', function () {
			var e = !1;
			try {
				var t = Object.defineProperty({}, 'passive', {
					get: function () {
						e = !0;
					},
				});
				window.addEventListener('test', null, t);
			} catch (r) {}
			return e;
		});
	var supports = !1;
	try {
		supports = 'WebSocket' in window && 2 === window.WebSocket.CLOSING;
	} catch (e) {}
	Modernizr.addTest('websockets', supports),
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
		Modernizr.addTest('generators', function () {
			try {
				new Function('function* test() {}')();
			} catch (e) {
				return !1;
			}
			return !0;
		}),
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
		Modernizr.addTest('localstorage', function () {
			var e = 'modernizr';
			try {
				return (
					localStorage.setItem(e, e), localStorage.removeItem(e), !0
				);
			} catch (t) {
				return !1;
			}
		}),
		Modernizr.addTest('webworkers', 'Worker' in window);
	var docElement = document.documentElement,
		isSVG = 'svg' === docElement.nodeName.toLowerCase();
	Modernizr.addTest('canvas', function () {
		var e = createElement('canvas');
		return !(!e.getContext || !e.getContext('2d'));
	});
	var canvas = createElement('canvas');
	Modernizr.addTest('todataurljpeg', function () {
		return (
			!!Modernizr.canvas &&
			0 === canvas.toDataURL('image/jpeg').indexOf('data:image/jpeg')
		);
	}),
		Modernizr.addTest('todataurlpng', function () {
			return (
				!!Modernizr.canvas &&
				0 === canvas.toDataURL('image/png').indexOf('data:image/png')
			);
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
			} catch (t) {}
			return e;
		}),
		Modernizr.addTest('fileinput', function () {
			if (
				navigator.userAgent.match(
					/(Android (1.0|1.1|1.5|1.6|2.0|2.1))|(Windows Phone (OS 7|8.0))|(XBLWP)|(ZuneWP)|(w(eb)?OSBrowser)|(webOS)|(Kindle\/(1.0|2.0|2.5|3.0))/
				)
			)
				return !1;
			var e = createElement('input');
			return (e.type = 'file'), !e.disabled;
		}),
		Modernizr.addTest(
			'placeholder',
			'placeholder' in createElement('input') &&
				'placeholder' in createElement('textarea')
		),
		Modernizr.addTest('scriptasync', 'async' in createElement('script'));
	var inputElem = createElement('input'),
		inputattrs = 'autocomplete autofocus list placeholder max min multiple pattern required step'.split(
			' '
		),
		attrs = {};
	Modernizr.input = (function (e) {
		for (var t = 0, r = e.length; r > t; t++)
			attrs[e[t]] = !!(e[t] in inputElem);
		return (
			attrs.list &&
				(attrs.list = !(
					!createElement('datalist') || !window.HTMLDataListElement
				)),
			attrs
		);
	})(inputattrs);
	var newSyntax = 'CSS' in window && 'supports' in window.CSS,
		oldSyntax = 'supportsCSS' in window;
	Modernizr.addTest('supports', newSyntax || oldSyntax);
	var hasOwnProp;
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
					var e, n;
					for (e = 0; e < r.length; e++) (n = r[e])(t);
				}, 0),
					delete this._l[e];
			}
		}),
		Modernizr._q.push(function () {
			ModernizrProto.addTest = addTest;
		});
	var omPrefixes = 'Moz O ms Webkit',
		cssomPrefixes = ModernizrProto._config.usePrefixes
			? omPrefixes.split(' ')
			: [];
	ModernizrProto._cssomPrefixes = cssomPrefixes;
	var atRule = function (e) {
		var t,
			r = prefixes.length,
			n = window.CSSRule;
		if ('undefined' == typeof n) return undefined;
		if (!e) return !1;
		if (
			((e = e.replace(/^@/, '')),
			(t = e.replace(/-/g, '_').toUpperCase() + '_RULE'),
			t in n)
		)
			return '@' + e;
		for (var o = 0; r > o; o++) {
			var i = prefixes[o],
				s = i.toUpperCase() + '_' + t;
			if (s in n) return '@-' + i.toLowerCase() + '-' + e;
		}
		return !1;
	};
	ModernizrProto.atRule = atRule;
	var domPrefixes = ModernizrProto._config.usePrefixes
		? omPrefixes.toLowerCase().split(' ')
		: [];
	ModernizrProto._domPrefixes = domPrefixes;
	var modElem = {elem: createElement('modernizr')};
	Modernizr._q.push(function () {
		delete modElem.elem;
	});
	var mStyle = {style: modElem.elem.style};
	Modernizr._q.unshift(function () {
		delete mStyle.style;
	}),
		(ModernizrProto.testAllProps = testPropsAll);
	var prefixed = (ModernizrProto.prefixed = function (e, t, r) {
		return 0 === e.indexOf('@')
			? atRule(e)
			: (-1 != e.indexOf('-') && (e = cssToDOM(e)),
			  t ? testPropsAll(e, t, r) : testPropsAll(e, 'pfx'));
	});
	Modernizr.addAsyncTest(function () {
		var e;
		try {
			e = prefixed('indexedDB', window);
		} catch (t) {}
		if (e) {
			var r = 'modernizr-' + Math.random(),
				n = e.open(r);
			(n.onerror = function () {
				n.error && 'InvalidStateError' === n.error.name
					? addTest('indexeddb', !1)
					: (addTest('indexeddb', !0), detectDeleteDatabase(e, r));
			}),
				(n.onsuccess = function () {
					addTest('indexeddb', !0), detectDeleteDatabase(e, r);
				});
		} else addTest('indexeddb', !1);
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
		Modernizr.addTest('flexbox', testAllProps('flexBasis', '1px', !0)),
		Modernizr.addTest('csstransforms3d', function () {
			return !!testAllProps('perspective', '1px', !0);
		}),
		Modernizr.addTest(
			'csstransitions',
			testAllProps('transition', 'all', !0)
		),
		testRunner(),
		setClasses(classes),
		delete ModernizrProto.addTest,
		delete ModernizrProto.addAsyncTest;
	for (var i = 0; i < Modernizr._q.length; i++) Modernizr._q[i]();
	window.Modernizr = Modernizr;
})(window, document);
