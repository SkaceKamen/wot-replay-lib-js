pickle = {
	//Use this object to store some GLOBAL stuff, dunno what is it for
	modules: {},
	
	genops: function(buff) {
		var view = new pickle.view(buff),
			codes = [];
			
		while(true) {
			var pos = view.tell(),
				code = view.getChar(),
				opcode = pickle.opcodes[code],
				arg = null;
				
			if (typeof(opcode) === "undefined") {
				throw new Error("Position " + (view.tell()-1) + ": unknown opcode: " + code.charCodeAt(0));
			}
			if (opcode.arg != null) {
				if (!this.types[opcode.arg])
					throw new Error("Undefined type " + opcode.arg);
				arg = this.readers[this.types[opcode.arg].reader](view);
			}

			codes.push([opcode, arg, pos]);
	
			if (code == '.')
				break;
		}
		
		return codes;
	},
	
	load: function(buff) {
		var stack = new pickle.linkedList(),
			memo = {},
			ops = this.genops(buff);
		
		for(var i in ops) {
			var op = ops[i],
				opcode = op[0],
				arg = op[1],
				pos = op[2],
				result = null;
			
			this.stack = stack;
			this.position = pos;
			
			result = opcode.dispatch(stack, arg, memo);

			/*
			console.log(pos, opcode.name, arg);
			console.log(stack.toString());
			*/
			
			if (typeof(result) !== "undefined")
				return result;
		}
		
		throw new Error("STOP opcode is missing");
	},
	
	findClass: function(module, name) {
		if (!this.modules[module])
			throw new Error("Undefined module " + module);
		if (!this.modules[module][name])
			throw new Error("Undefined " + module + "." + name);
		return this.modules[module][name];
	},
	
	mark: function(stack) {
		var iter = stack.getIter();
		while((item = iter.prev())) {
			if (item instanceof pickle.marker)
				return iter;
		}
		throw new Error("Mark not found");
	},
}

//Dummy class
pickle.marker = function() { };
pickle.marker.prototype.toString = function() {
	return "pickle.marker";
}

//Used to mark basic types inside stack
pickle.container = function(value) {
	this.value = value;
}

pickle.container.prototype.toString = function() {
	if (this.value.constructor === Array)
		return "a(" + this.value + ")";
	if (this.value.toString)
		return this.value.toString();
	return this.value;
}

//Binary view with position tracking and little endian as default
pickle.view = function(buff) {
	this.view = new DataView(buff);
	this.byteLength = this.view.byteLength;
	this.position = 0;
}
pickle.view.prototype = {
	tell: function() {
		return this.position;
	},
	seek: function(position) {
		this.position = position;
	},
	readline: function(ending) { 
		var data = "";
		if (typeof(ending) === "undefined")
			ending = "\n";
		
		while (this.tell() < this.byteLength) {
			var c = this.getChar();
			data += c;
			if (c === ending)
				break;
		}
		return data;
	},
	getChar: function() { 
		return String.fromCharCode(this.getUint8());
	},
	getChars: function(n) { 
		var str = "";
		for(var i = 0; i < n; i++) {
			str += this.getChar();
		}
		return str;
	},
	getInt8: function() { 
		var pos = this.position;
		this.position += 1;
		return this.view.getInt8(pos);
	},
	getUint8: function() { 
		var pos = this.position;
		this.position += 1;
		return this.view.getUint8(pos);
	},
	getInt16: function(big) { 
		var pos = this.position;
		this.position += 2;
		return this.view.getInt16(pos, !big);
	},
	getUint16: function(big) { 
		var pos = this.position;
		this.position += 2;
		return this.view.getUint16(pos, !big);
	},
	getInt32: function(big) { 
		var pos = this.position;
		this.position += 4;
		return this.view.getInt32(pos, !big);
	},
	getUint32: function(big) { 
		var pos = this.position;
		this.position += 4;
		return this.view.getUint32(pos, !big);
	},
	getFloat32: function(big) { 
		var pos = this.position;
		this.position += 4;
		return this.view.getFloat32(pos, !big);
	},
	getFloat64: function(big) { 
		var pos = this.position;
		this.position += 8;
		return this.view.getFloat64(pos, !big);
	},
	getUint8: function() { 
		var pos = this.position;
		this.position += 1;
		return this.view.getUint8(pos);
	}
}

pickle.readers = {
	'read_uint1': function(view) {
		return view.getUint8();
	},
	'read_uint2': function(view) {
		return view.getUint16();
	},
	'read_int4': function(view) {
		return view.getInt32();
	},
	'read_stringnl': function(view, decode, stripquotes) {
		if (typeof(decode) === "undefined")
			decode = true;
		if (typeof(stripquotes) === "undefined")
			stripquotes = true;
		
		var data = view.readline();
		
		if (data.substr(data.length - 1, 1) != "\n")
			throw new Error("No newline found when trying to read stringnl");
		
		data = data.substr(0, data.length - 1);
		
		if (stripquotes) {
			var c = ["'",'"'],
				s = false;
			for(var i = 0; i < c.length; i++) {
				var ch = c[i];
				if (data[0] == ch) {
					if (data[data.length - 1] != ch)
						throw new Error("strinq quote " + ch + " not found at both ends of " + data);
					data = data.substr(1, data.length - 2);
					s = true;
				}
			}
			
			if (!s)
				throw new Error("no string quotes around " + data);
		}
		
		if (decode) {
			console.warn("String is currently not decoded.");
		}
		return data;
	},
	'read_stringnl_noescape': function(view) {
		return this.read_stringnl(view, false, false);
	},
	'read_stringnl_noescape_pair': function(view) {
		return [this.read_stringnl(view, false, false), this.read_stringnl(view, false, false)];
	},
	'read_string4': function(view) {
		return view.getChars(this.read_int4(view));
	},
	'read_string1': function(view) {
		return view.getChars(this.read_uint1(view));
	},
	'read_unicodestringnl': function(view) {
		var data = view.readline();
		if (data.substr(data.length - 1, 1) != "\n")
			throw new Error("No newline found when trying to read unicodestringnl");
		
		console.warn('String may not be decoded');
		// unicode(data, 'raw-unicode-escape')
		
		return data.substr(0, data.length - 1);
	},
	'read_unicodestring4': function(view) {
		console.warn('String may not be decoded');
		// return unicode(data, 'utf-8')
		
		return view.getChars(this.read_int4(view));
	},
	'read_decimalnl_short': function(view) {
		var s = this.read_stringnl(view, false, false);
		if (s.substring(s.length - 1) == "L")
			throw new Error("Trailing 'L' not allowed in " + s);
		
		if (s == "00")
			return false;
		if (s == "01")
			return true;
		
		return parseInt(s);
	},
	'read_decimalnl_long': function(view) {
		var s = this.read_stringnl(view, false, false);
		if (s.substring(s.length - 1) != "L")
			throw new Error("Trailing 'L' is required in " + s);
		return parseInt(s.substr(0, s.length - 1));
	},
	'read_floatnl': function(view) {
		return parseFloat(this.read_stringnl(view, false, false));
	},
	'read_float8': function(view) {
		return view.getFloat64();
	},
	'decode_long': function(long) {
		var nbytes = long.length,
			hex = "";
		
		if (nbytes == 0)
			return 0;
		
		//ashex = _binascii.hexlify(data[::-1])
		for(var i = 0; i < long.length - 1; i += 1) {
			var h = long.charCodeAt(long.length - i).toString(16);
			if (h.length == 0)
				h = "00";
			if (h.length == 1)
				h = "0" + h;
			h += hex;
		}
		
		n = parseInt(h, 16)
		if (long.charCodeAt(long.length - 1) == 0x80)
			n -= 1 << (nbytes * 8);
		return n;
		
		//n = long(ashex, 16) # quadratic time before Python 2.3; linear now
		//if data[-1] >= '\x80':
		//n -= 1L << (nbytes * 8)
	},
	'read_long1': function(view) {
		return this.decode_long(view.getChars(this.read_uint1(view)));
	},
	'read_long4': function(view) {
		return this.decode_long(view.getChars(this.read_int4(view)));
	}
}

// Represents the number of bytes consumed by an argument delimited by the
// next newline character.
pickle.UP_TO_NEWLINE = -1

// Represents the number of bytes consumed by a two-argument opcode where
// the first argument gives the number of bytes in the second argument.
pickle.TAKEN_FROM_ARGUMENT1 = -2   // num bytes is 1-byte unsigned int
pickle.TAKEN_FROM_ARGUMENT4 = -3   // num bytes is 4-byte signed little-endian int

pickle.types = {
	'uint1': { 'name': 'uint1', n: 1, reader: 'read_uint1' },
	'uint2': { 'name': 'uint2', n: 2, reader: 'read_uint2' },
	'int4': { 'name': 'int4', n: 4, reader: 'read_int4' },
	'stringnl_noescape': { 'name': 'stringnl_noescape', n: pickle.UP_TO_NEWLINE, reader: 'read_stringnl_noescape' },
	'stringnl': { 'name': 'stringnl', n: pickle.UP_TO_NEWLINE, reader: 'read_stringnl' },	
	'stringnl_noescape_pair': { 'name': 'stringnl_noescape_pair', n: pickle.UP_TO_NEWLINE, reader: 'read_stringnl_noescape_pair' },
	'string4': { 'name': "string4", n: pickle.TAKEN_FROM_ARGUMENT4, reader: 'read_string4' },
	'string1': { 'name': "string1", n: pickle.TAKEN_FROM_ARGUMENT1, reader: 'read_string1' },
	'unicodestringnl': { 'name': 'unicodestringnl', n: pickle.UP_TO_NEWLINE, reader: 'read_unicodestringnl' },
	'unicodestring4': { 'name': "unicodestring4", n: pickle.TAKEN_FROM_ARGUMENT4, reader: 'read_unicodestring4' },
	'decimalnl_short': { 'name': 'decimalnl_short', n: pickle.UP_TO_NEWLINE, reader: 'read_decimalnl_short' },
	'decimalnl_long': { 'name': 'decimalnl_long', n: pickle.UP_TO_NEWLINE, reader: 'read_decimalnl_long' },
	'floatnl': { 'name': 'floatnl', n: pickle.UP_TO_NEWLINE, reader: 'read_floatnl' },
	'float8': { 'name': 'float8', n: 8, reader: 'read_float8' },
	'long1': { 'name': "long1", n: pickle.TAKEN_FROM_ARGUMENT1, reader: 'read_long1' },
	'long4': { 'name': "long4", n: pickle.TAKEN_FROM_ARGUMENT4, reader: 'read_long4' }
}

pickle._push = function(stack, arg) {
	stack.push(new pickle.container(arg));
},

pickle.opcodes = {

	// Ways to spell integers.

	'I': {
		'name': 'INT',
		'code': 'I',
		'arg': 'decimalnl_short',
		'proto': 0,
		'dispatch': pickle._push
	},
	'J': {
		'name': 'BININT',
		'code': 'J',
		'arg': 'int4',
		'proto': 1,
		'dispatch': pickle._push
	},
	'K': {
		'name': 'BININT1',
		'code': 'K',
		'arg': 'uint1',
		'proto': 1,
		'dispatch': pickle._push
	},
	'M': {
		'name': 'BININT2',
		'code': 'M',
		'arg': 'uint2',
		'proto': 1,
		'dispatch': pickle._push
	},
	'L': {
		'name': 'LONG',
		'code': 'L',
		'arg': 'decimalnl_long',
		'proto': 0,
		'dispatch': pickle._push
	},
	'\x8a': {
		'name': "LONG1",
		'code': '\x8a',
		'arg': 'long1',
		'proto': 2,
		'dispatch': pickle._push
	},
	'\x8b': {
		'name': "LONG4",
		'code': '\x8b',
		'arg': 'long4',
		'proto': 2,
		'dispatch': pickle._push
	},

	// Ways to spell strings (8-bit, not Unicode).

	'S': {
		'name': 'STRING',
		'code': 'S',
		'arg': 'stringnl',
		'proto': 0,
		'dispatch': pickle._push
	},
	'T': {
		'name': 'BINSTRING',
		'code': 'T',
		'arg': 'string4',
		'proto': 1,
		'dispatch': pickle._push
	},
	'U': {
		'name': 'SHORT_BINSTRING',
		'code': 'U',
		'arg': 'string1',
		'proto': 1,
		'dispatch': pickle._push
	},

	// Ways to spell None.

	'N': {
		'name': 'NONE',
		'code': 'N',
		'arg': null,
		'proto': 0,
		'dispatch': pickle._push
	},

	// Ways to spell bools, starting with proto 2.  See INT for how this was
	// done before proto 2.

	'\x88': {
		'name': 'NEWTRUE',
		'code': '\x88',
		'arg': null,
		'proto': 2,
		'dispatch': function(stack, arg) {
			stack.push(new pickle.container(true));
		}
	},
	'\x89': {
		'name': 'NEWFALSE',
		'code': '\x89',
		'arg': null,
		'proto': 2,
		'dispatch': function(stack, arg) {
			stack.push(new pickle.container(false));
		}
	},

	// Ways to spell Unicode strings.

	'V': {
		'name': 'UNICODE',
		'code': 'V',
		'arg': 'unicodestringnl',
		'proto': 0,
		'dispatch': pickle._push
	},
	'X': {
		'name': 'BINUNICODE',
		'code': 'X',
		'arg': 'unicodestring4',
		'proto': 1,
		'dispatch': pickle._push
	},

	// Ways to spell floats.

	'F': {
		'name': 'FLOAT',
		'code': 'F',
		'arg': 'floatnl',
		'proto': 0,
		'dispatch': pickle._push
	},
	'G': {
		'name': 'BINFLOAT',
		'code': 'G',
		'arg': 'float8',
		'proto': 1,
		'dispatch': pickle._push
	},

	// Ways to build lists.

	']': {
		'name': 'EMPTY_LIST',
		'code': ']',
		'arg': null,
		'proto': 1,
		'dispatch': function(stack, arg) { stack.push(new pickle.container([])); }
	},
	'a': {
		'name': 'APPEND',
		'code': 'a',
		'arg': null,
		'proto': 0,
		'dispatch': function(stack, arg) {
			val = stack.popLast().value;
			stack.last().value.push(val);
		}
	},
	'e': {
		'name': 'APPENDS',
		'code': 'e',
		'arg': null,
		'proto': 1,
		'dispatch': function(stack, arg) {
			//SUCH HACKS, MUCH WOW
			mark = pickle.mark(stack);
			list = mark.prev().value;
			limit = mark.next();
			while((item = mark.next())) {
				list.push(item.value);
				stack.remove(item);
			}
			stack.remove(limit);
		},
	},
	'l': {
		'name': 'LIST',
		'code': 'l',
		'arg': null,
		'proto': 0,
		'dispatch': function(stack, arg) {
			//SUCH HACKS, MUCH WOW
			mark = pickle.mark(stack);
			list = [];
			
			limit = mark.current();
			while((item = mark.next())) {
				list.push(item.value);
			}
			
			stack.replace(limit, new pickle.container(list));
		}
	},

	// Ways to build tuples.

	')': {
		'name': 'EMPTY_TUPLE',
		'code': ')',
		'arg': null,
		'proto': 1,
		'dispatch': function(stack, arg) { stack.push(new pickle.container([])) }
	},
	't': {
		'name': 'TUPLE',
		'code': 't',
		'arg': null,
		'proto': 0,
		'dispatch': function(stack, arg) {
			//SUCH HACKS, MUCH WOW
			mark = pickle.mark(stack);
			list = [];
			limit = mark.current();
			while((item = mark.next())) {
				list.push(item.value);
				stack.remove(item);
			}
			stack.replace(limit, new pickle.container(list));
		}
	},
	'\x85': {
		'name': 'TUPLE1',
		'code': '\x85',
		'arg': null,
		'proto': 2,
		'dispatch': function(stack, arg) {
			var last = stack.last();
			stack.push(new pickle.container([last.value]));
			stack.remove(last);
		}
	},
	'\x86': {
		'name': 'TUPLE2',
		'code': '\x86',
		'arg': null,
		'proto': 2,
		'dispatch': function(stack, arg) {
			var list = [],
				iter = stack.getIter(),
				item = null,
				count = 2;
			
			while(count-- > 0 && (item = iter.prev())) {
				list[count] = item.value;
				if (count != 0)
					stack.remove(item);
			}
			
			stack.replace(item, new pickle.container(list));
		}
	},
	'\x87': {
		'name': 'TUPLE3',
		'code': '\x87',
		'arg': null,
		'proto': 2,
		'dispatch': function(stack, arg) {
			var list = [],
				iter = stack.getIter(),
				item = null,
				count = 3;
			
			while(count-- > 0 && (item = iter.prev())) {
				list[count] = item.value;
				if (count != 0)
					stack.remove(item);
			}
			
			stack.replace(item, new pickle.container(list));
		}
	},

	// Ways to build dicts.

	'}': {
		'name': 'EMPTY_DICT',
		'code': '}',
		'arg': null,
		'proto': 1,
		'dispatch': function(stack, arg) { stack.push(new pickle.container({})) }
	},
	'd': {
		'name': 'DICT',
		'code': 'd',
		'arg': null,
		'proto': 0,
		'dispatch': function(stack, arg) {
			var mark = pickle.mark(stack),
				d = {},
				limit = mark.current();
			while((item = mark.next())) {
				key = item;
				value = mark.next();
				stack.remove(key);
				stack.remove(value);
				d[key.value] = value.value;
			}
			stack.replace(limit, new pickle.container(d));
		}
	},
	's': {
		'name': 'SETITEM',
		'code': 's',
		'arg': null,
		'proto': 0,
		'dispatch': function(stack, arg) {
			value = stack.popLast().value;
			key = stack.popLast().value;
			dict = stack.last().value;
			dict[key] = value;
		}
	},
	'u': {
		'name': 'SETITEMS',
		'code': 'u',
		'arg': null,
		'proto': 1,
		'dispatch': function(stack, arg) {
			mark = pickle.mark(stack);
			limit = mark.current();
			dict = mark.prev().value;
			
			mark.next();
			while((item = mark.next())) {
				key = item;
				value = mark.next();
				dict[key.value] = value.value;
				stack.remove(key);
				stack.remove(value);
			}
			
			stack.remove(limit);
		}
	},

	// Stack manipulation.

	'0': {
		'name': 'POP',
		'code': '0',
		'arg': null,
		'proto': 0,
		'dispatch': function(stack, arg) {
			stack.popLast();
		}
	},
	'2': {
		'name': 'DUP',
		'code': '2',
		'arg': null,
		'proto': 0,
		'dispatch': function(stack, arg) {
			stack.push(stack.last());
		}
	},
	'(': {
		'name': 'MARK',
		'code': '(',
		'arg': null,
		'proto': 0,
		'dispatch': function(stack, arg) {
			stack.push(new pickle.marker());
		}
	},
	'1': {
		'name': 'POP_MARK',
		'code': '1',
		'arg': null,
		'proto': 1,
		'dispatch': function(stack, arg) {
			var mark = pickle.mark(stack);
			stack.remove(mark.current());
			while((item = mark.next())) {
				stack.remove(item);
			}
		}
	},

	// Memo manipulation.  There are really only two operations (get and put),
	// each in all-text, "short binary", and "long binary" flavors.

	'g': {
		'name': 'GET',
		'code': 'g',
		'arg': 'stringnl_noescape',
		'proto': 0,
		'dispatch': function(stack, arg, memo) {
			stack.push(memo[arg]);
		}
	},
	'h': {
		'name': 'BINGET',
		'code': 'h',
		'arg': 'uint1',
		'proto': 1,
		'dispatch': function(stack, arg, memo) {
			stack.push(memo[arg]);
		}
	},
	'j': {
		'name': 'LONG_BINGET',
		'code': 'j',
		'arg': 'int4',
		'proto': 1,
		'dispatch': function(stack, arg, memo) {
			stack.push(memo[arg]);
		}
	},
	'p': {
		'name': 'PUT',
		'code': 'p',
		'arg': 'stringnl_noescape',
		'proto': 0,
		'dispatch': function(stack, arg, memo) {
			memo[arg] = stack.last();
		}
	},
	'q': {
		'name': 'BINPUT',
		'code': 'q',
		'arg': 'uint1',
		'proto': 1,
		'dispatch': function(stack, arg, memo) {
			memo[arg] = stack.last();
		}
	},
	'r': {
		'name': 'LONG_BINPUT',
		'code': 'r',
		'arg': 'int4',
		'proto': 1,
		'dispatch': function(stack, arg, memo) {
			memo[arg] = stack.last();
		}
	},

	// Access the extension registry (predefined objects).  Akin to the GET
	// family.

	'\x82': {
		'name': 'EXT1',
		'code': '\x82',
		'arg': 'uint1',
		'proto': 2,
		'dispatch': function(stack, arg, memo) {
			throw new Error("Unsupported opcode EXT1(" + arg + ")");
		}
	},
	'\x83': {
		'name': 'EXT2',
		'code': '\x83',
		'arg': 'uint2',
		'proto': 2,
		'dispatch': function(stack, arg, memo) {
			throw new Error("Unsupported opcode EXT2(" + arg + ")");
		}
	},
	'\x84': {
		'name': 'EXT4',
		'code': '\x84',
		'arg': 'int4',
		'proto': 2,
		'dispatch': function(stack, arg, memo) {
			throw new Error("Unsupported opcode EXT4(" + arg + ")");
		}
	},

	// Push a class object, or module function, on the stack, via its module
	// and name.

	'c': {
		'name': 'GLOBAL',
		'code': 'c',
		'arg': 'stringnl_noescape_pair',
		'proto': 0,
		'dispatch': function(stack, arg, memo) {
			stack.push(new pickle.container(pickle.findClass(arg[0], arg[1])));
			//throw new Error("Unsupported opcode GLOBAL(" + JSON.stringify(arg) + ")");
		}
	},

	// Ways to build objects of classes pickle doesn't know about directly
	// (user-defined classes).  I despair of documenting this accurately
	// and comprehensibly -- you really have to read the pickle code to
	// find all the special cases.

	'R': {
		'name': 'REDUCE',
		'code': 'R',
		'arg': null,
		'proto': 0,
		'dispatch': function(stack, arg, memo) {
			var arg = stack.popLast().value,
				value = stack.last().value.apply(this, arg.constructor === Array ? arg : [arg]);
			stack.replace(stack.last(), new pickle.container(value));
		}
	},
	'b': {
		'name': 'BUILD',
		'code': 'b',
		'arg': null,
		'proto': 0,
		'dispatch': function(stack, arg, memo) {
			throw new Error("Unsupported opcode BUILD");
		}
	},
	'i': {
		'name': 'INST',
		'code': 'i',
		'arg': 'stringnl_noescape_pair',
		'proto': 0,
		'dispatch': function(stack, arg, memo) {
			throw new Error("Unsupported opcode INST(" + JSON.stringify(arg) + ")");
		}
	},
	'o': {
		'name': 'OBJ',
		'code': 'o',
		'arg': null,
		'proto': 1,
		'dispatch': function(stack, arg, memo) {
			throw new Error("Unsupported opcode OBJ");
		}
	},
	'\x81': {
		'name': 'NEWOBJ',
		'code': '\x81',
		'arg': null,
		'proto': 2,
		'dispatch': function(stack, arg, memo) {
			throw new Error("Unsupported opcode NEWOBJ");
		}
	},

	// Machine control.

	'\x80': {
		'name': 'PROTO',
		'code': '\x80',
		'arg': 'uint1',
		'proto': 2,
		'dispatch': function(stack, arg, memo) {
			if (arg > 2)
				throw new Error("Unsupported protocol " + arg);
		}
	},
	'.': {
		'name': 'STOP',
		'code': '.',
		'arg': null,
		'proto': 0,
		'dispatch': function(stack, arg, memo) {
			return stack.popLast().value;
		}
	},

	// Ways to deal with persistent IDs.

	'P': {
		'name': 'PERSID',
		'code': 'P',
		'arg': 'stringnl_noescape',
		'proto': 0,
		'dispatch': function(stack, arg, memo) {
			throw new Error("Unsupported opcode PERSID(" + arg + ")");
		}
	},
	'Q': {
		'name': 'BINPERSID',
		'code': 'Q',
		'arg': null,
		'proto': 1,
		'dispatch': function(stack, arg, memo) {
			throw new Error("Unsupported opcode BINPERSID");
		}
	}
}

//Used for stack
pickle.linkedList = function() {
	this.id = pickle.linkedList.idCounter++;
	this.iter = new pickle.linkedList.iterator(this);
}
pickle.linkedList.idCounter = 0;
pickle.linkedList.prototype = {
	start: null,
	end: null,
	length: 0,
	id: 0,
	
	empty: function() {
		return this.length == 0;
	},
	
	/**
	 * Pushes new item to end of list
	 *
	 * @param var content
	 * @return object list item, used for operation such as removing
	 */
	push: function(obj) {
		var item = {
			previous: null,
			next: null,
			content: obj
		};
		
		if (!obj.__llReferences)
			obj.__llReferences = {};
		
		obj.__llReferences[this.id] = item;
		
		if (this.start == null) {
			this.start = item;
		}
		if (this.end == null) {
			this.end = item;
		} else {
			this.end.next = item;
			item.previous = this.end;
			item.next = null;
			this.end = item;
		}
		this.length++;
		return item;
	},
	
	contains: function(obj) {
		return obj.__llReferences && obj.__llReferences[this.id];
	},
	
	/**
	 * Pops item from start
	 * @return object popped content
	 */
	pop: function() {
		if (this.start == null)
			throw new Error("List is empty");
		
		var content = this.start.content;
		this.remove(this.start.content);
		return content;
	},
	
	/**
	 * Pops item from end
	 * @return object popped content
	 */
	popLast: function() {
		if (this.end == null)
			throw new Error("List is empty");
	
		var content = this.end.content;
		this.remove(this.end.content);
		return content;
	},
	
	replace: function(original, replaced) {
		if (!original.__llReferences)
			original.__llReferences = {};
		original = original.__llReferences[this.id];
		
		if (!original)
			throw new Error("Trying to replace undefined item");
		
		if (!replaced.__llReferences)
			replaced.__llReferences = {};
		
		delete(original.content.__llReferences[this.id]);
		replaced.__llReferences[this.id] = original;
		original.content = replaced;
	},
	
	/**
	 * Inserts content after specified item
	 *
	 * @param object after item to be inserted after
	 * @param var	obj   content to be inserted
	 * @return object list item
	 */
	insert: function(after, obj) {	
		var item = {
			previous: null,
			next: null,
			content: obj
		};
		
		if (!obj.__llReferences)
			obj.__llReferences = {};
		
		obj.__llReferences[this.id] = item;
		
		if (after) {
			if (!after.__llReferences)
				after.__llReferences = {};
			after = after.__llReferences[this.id];
			
			if (!after)
				throw new Error("Trying to insert after undefined item");
		}
		
		item.previous = after;
		item.next = after != null ? after.next : null;
		
		this.length++;
		
		//Insert at beginning
		if (after == null) {
			item.next = this.start;
			if (this.start != null)
				this.start.previous = item;
			this.start = item;
			if (this.end == null)
				this.end = this.start;
			return item;
		}
		
		//Update back reference
		if (after.next != null) {
			after.next.previous = item;
		}
		
		//Update next reference
		after.next = item;
		
		//Update ending reference
		if (after == this.end) {
			this.end = item;
		}
			
		return item;
	},
	
	/**
	 * Removes specified item from list
	 *
	 * @param object item (not content!)
	 * @return boolean true if item was removed, false if not
	 */
	remove: function(obj) {
		var item = obj.__llReferences ? obj.__llReferences[this.id] : null;
		
		if (item === undefined || item == null)
			throw new Error("Item to be removed was not specified");
	
		delete(obj.__llReferences[this.id]);
	
		if (this.start == null || this.end == null)
			return false;
		
		this.length--;
		
		if (item == this.end && item == this.start) {
			this.end = null;
			this.start = null;
			return true;
		}
		
		if (item == this.end) {
			this.end = this.end.previous;
			if (this.end != null)
				this.end.next = null;
			return true;
		}
		
		if (item == this.start) {
			this.start = item.next;
			if (this.start != null)
				this.start.previous = null;
			return true;
		}
		
		item.previous.next = item.next;
		item.next.previous = item.previous;

		return true;
	},
	
	/**
	 * Cycles throught all items. Callback is called with following arguments:
	 *  item content
	 *  item
	 *  item index
	 *
	 * If callback returns anything considered as true, cycle will be stopped.
	 *
	 * @param function callback
	 */
	each: function(callback) {
		var current = this.start, index = 0;
		while(current != null) {
			if (callback(current.content, current, index))
				break;
			current = current.next;
			index++;
		}
	},
	
	first: function() {
		return this.start.content;
	},
	
	last: function() {
		return this.end.content;
	},
	
	firstItem: function() {
		return this.start;
	},
	
	lastItem: function() {
		return this.end;
	},
	
	getIter: function() {
		return new pickle.linkedList.iterator(this);
	},
	
	toString: function() {
		var iter = this.getIter(),
			str = "[";
		while(item = iter.next()) {
			var val = item.toString();
			if (val.length > 44)
				val = val.substr(0,40) + "...";

			if (item.constructor === Array) {
				str += "a(" + val + "),";
			} else {
				str += val + ",";
			}
		}
		if (str.substr(str.length - 1, 1) == ",")
			str = str.substr(0, str.length - 1);
		str += "]";
		return str;
	},
}

pickle.linkedList.iterator = function(ll) { this.ll = ll; }
pickle.linkedList.iterator.prototype = {
	point: null,
	reset: function() {
		this.point = null
	},
	current: function() {
		return this.point ? this.point.content : null;
	},
	prev: function() {
		if (this.point == null)
			this.point = this.ll.lastItem();
		else
			this.point = this.point.previous;
		return this.current();
	},
	next: function() {
		if (this.point == null)
			this.point = this.ll.firstItem();
		else
			this.point = this.point.next;
		return this.current();
	}
}
