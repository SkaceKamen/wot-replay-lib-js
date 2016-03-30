wot = {};

pickle = {
    modules: {},
    genops: function(buff) {
        var view = new pickle.view(buff), codes = [];
        while (true) {
            var pos = view.tell(), code = view.getChar(), opcode = pickle.opcodes[code], arg = null;
            if (typeof opcode === "undefined") {
                throw new Error("Position " + (view.tell() - 1) + ": unknown opcode: " + code.charCodeAt(0));
            }
            if (opcode.arg != null) {
                if (!this.types[opcode.arg]) throw new Error("Undefined type " + opcode.arg);
                arg = this.readers[this.types[opcode.arg].reader](view);
            }
            codes.push([ opcode, arg, pos ]);
            if (code == ".") break;
        }
        return codes;
    },
    load: function(buff) {
        var stack = new pickle.linkedList(), memo = {}, ops = this.genops(buff);
        for (var i in ops) {
            var op = ops[i], opcode = op[0], arg = op[1], pos = op[2], result = null;
            this.stack = stack;
            this.position = pos;
            result = opcode.dispatch(stack, arg, memo);
            if (typeof result !== "undefined") return result;
        }
        throw new Error("STOP opcode is missing");
    },
    findClass: function(module, name) {
        if (!this.modules[module]) throw new Error("Undefined module " + module);
        if (!this.modules[module][name]) throw new Error("Undefined " + module + "." + name);
        return this.modules[module][name];
    },
    mark: function(stack) {
        var iter = stack.getIter();
        while (item = iter.prev()) {
            if (item instanceof pickle.marker) return iter;
        }
        throw new Error("Mark not found");
    }
};

pickle.marker = function() {};

pickle.marker.prototype.toString = function() {
    return "pickle.marker";
};

pickle.container = function(value) {
    this.value = value;
};

pickle.container.prototype.toString = function() {
    if (this.value.constructor === Array) return "a(" + this.value + ")";
    if (this.value.toString) return this.value.toString();
    return this.value;
};

pickle.view = function(buff) {
    this.view = new DataView(buff);
    this.byteLength = this.view.byteLength;
    this.position = 0;
};

pickle.view.prototype = {
    tell: function() {
        return this.position;
    },
    seek: function(position) {
        this.position = position;
    },
    readline: function(ending) {
        var data = "";
        if (typeof ending === "undefined") ending = "\n";
        while (this.tell() < this.byteLength) {
            var c = this.getChar();
            data += c;
            if (c === ending) break;
        }
        return data;
    },
    getChar: function() {
        return String.fromCharCode(this.getUint8());
    },
    getChars: function(n) {
        var str = "";
        for (var i = 0; i < n; i++) {
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
};

pickle.readers = {
    read_uint1: function(view) {
        return view.getUint8();
    },
    read_uint2: function(view) {
        return view.getUint16();
    },
    read_int4: function(view) {
        return view.getInt32();
    },
    read_stringnl: function(view, decode, stripquotes) {
        if (typeof decode === "undefined") decode = true;
        if (typeof stripquotes === "undefined") stripquotes = true;
        var data = view.readline();
        if (data.substr(data.length - 1, 1) != "\n") throw new Error("No newline found when trying to read stringnl");
        data = data.substr(0, data.length - 1);
        if (stripquotes) {
            var c = [ "'", '"' ], s = false;
            for (var i = 0; i < c.length; i++) {
                var ch = c[i];
                if (data[0] == ch) {
                    if (data[data.length - 1] != ch) throw new Error("strinq quote " + ch + " not found at both ends of " + data);
                    data = data.substr(1, data.length - 2);
                    s = true;
                }
            }
            if (!s) throw new Error("no string quotes around " + data);
        }
        if (decode) {
            console.warn("String is currently not decoded.");
        }
        return data;
    },
    read_stringnl_noescape: function(view) {
        return this.read_stringnl(view, false, false);
    },
    read_stringnl_noescape_pair: function(view) {
        return [ this.read_stringnl(view, false, false), this.read_stringnl(view, false, false) ];
    },
    read_string4: function(view) {
        return view.getChars(this.read_int4(view));
    },
    read_string1: function(view) {
        return view.getChars(this.read_uint1(view));
    },
    read_unicodestringnl: function(view) {
        var data = view.readline();
        if (data.substr(data.length - 1, 1) != "\n") throw new Error("No newline found when trying to read unicodestringnl");
        console.warn("String may not be decoded");
        return data.substr(0, data.length - 1);
    },
    read_unicodestring4: function(view) {
        console.warn("String may not be decoded");
        return view.getChars(this.read_int4(view));
    },
    read_decimalnl_short: function(view) {
        var s = this.read_stringnl(view, false, false);
        if (s.substring(s.length - 1) == "L") throw new Error("Trailing 'L' not allowed in " + s);
        if (s == "00") return false;
        if (s == "01") return true;
        return parseInt(s);
    },
    read_decimalnl_long: function(view) {
        var s = this.read_stringnl(view, false, false);
        if (s.substring(s.length - 1) != "L") throw new Error("Trailing 'L' is required in " + s);
        return parseInt(s.substr(0, s.length - 1));
    },
    read_floatnl: function(view) {
        return parseFloat(this.read_stringnl(view, false, false));
    },
    read_float8: function(view) {
        return view.getFloat64();
    },
    decode_long: function(long) {
        var nbytes = long.length, hex = "";
        if (nbytes == 0) return 0;
        for (var i = 0; i < long.length - 1; i += 1) {
            var h = long.charCodeAt(long.length - i).toString(16);
            if (h.length == 0) h = "00";
            if (h.length == 1) h = "0" + h;
            h += hex;
        }
        n = parseInt(h, 16);
        if (long.charCodeAt(long.length - 1) == 128) n -= 1 << nbytes * 8;
        return n;
    },
    read_long1: function(view) {
        return this.decode_long(view.getChars(this.read_uint1(view)));
    },
    read_long4: function(view) {
        return this.decode_long(view.getChars(this.read_int4(view)));
    }
};

pickle.UP_TO_NEWLINE = -1;

pickle.TAKEN_FROM_ARGUMENT1 = -2;

pickle.TAKEN_FROM_ARGUMENT4 = -3;

pickle.types = {
    uint1: {
        name: "uint1",
        n: 1,
        reader: "read_uint1"
    },
    uint2: {
        name: "uint2",
        n: 2,
        reader: "read_uint2"
    },
    int4: {
        name: "int4",
        n: 4,
        reader: "read_int4"
    },
    stringnl_noescape: {
        name: "stringnl_noescape",
        n: pickle.UP_TO_NEWLINE,
        reader: "read_stringnl_noescape"
    },
    stringnl: {
        name: "stringnl",
        n: pickle.UP_TO_NEWLINE,
        reader: "read_stringnl"
    },
    stringnl_noescape_pair: {
        name: "stringnl_noescape_pair",
        n: pickle.UP_TO_NEWLINE,
        reader: "read_stringnl_noescape_pair"
    },
    string4: {
        name: "string4",
        n: pickle.TAKEN_FROM_ARGUMENT4,
        reader: "read_string4"
    },
    string1: {
        name: "string1",
        n: pickle.TAKEN_FROM_ARGUMENT1,
        reader: "read_string1"
    },
    unicodestringnl: {
        name: "unicodestringnl",
        n: pickle.UP_TO_NEWLINE,
        reader: "read_unicodestringnl"
    },
    unicodestring4: {
        name: "unicodestring4",
        n: pickle.TAKEN_FROM_ARGUMENT4,
        reader: "read_unicodestring4"
    },
    decimalnl_short: {
        name: "decimalnl_short",
        n: pickle.UP_TO_NEWLINE,
        reader: "read_decimalnl_short"
    },
    decimalnl_long: {
        name: "decimalnl_long",
        n: pickle.UP_TO_NEWLINE,
        reader: "read_decimalnl_long"
    },
    floatnl: {
        name: "floatnl",
        n: pickle.UP_TO_NEWLINE,
        reader: "read_floatnl"
    },
    float8: {
        name: "float8",
        n: 8,
        reader: "read_float8"
    },
    long1: {
        name: "long1",
        n: pickle.TAKEN_FROM_ARGUMENT1,
        reader: "read_long1"
    },
    long4: {
        name: "long4",
        n: pickle.TAKEN_FROM_ARGUMENT4,
        reader: "read_long4"
    }
};

pickle._push = function(stack, arg) {
    stack.push(new pickle.container(arg));
}, pickle.opcodes = {
    I: {
        name: "INT",
        code: "I",
        arg: "decimalnl_short",
        proto: 0,
        dispatch: pickle._push
    },
    J: {
        name: "BININT",
        code: "J",
        arg: "int4",
        proto: 1,
        dispatch: pickle._push
    },
    K: {
        name: "BININT1",
        code: "K",
        arg: "uint1",
        proto: 1,
        dispatch: pickle._push
    },
    M: {
        name: "BININT2",
        code: "M",
        arg: "uint2",
        proto: 1,
        dispatch: pickle._push
    },
    L: {
        name: "LONG",
        code: "L",
        arg: "decimalnl_long",
        proto: 0,
        dispatch: pickle._push
    },
    "": {
        name: "LONG1",
        code: "",
        arg: "long1",
        proto: 2,
        dispatch: pickle._push
    },
    "": {
        name: "LONG4",
        code: "",
        arg: "long4",
        proto: 2,
        dispatch: pickle._push
    },
    S: {
        name: "STRING",
        code: "S",
        arg: "stringnl",
        proto: 0,
        dispatch: pickle._push
    },
    T: {
        name: "BINSTRING",
        code: "T",
        arg: "string4",
        proto: 1,
        dispatch: pickle._push
    },
    U: {
        name: "SHORT_BINSTRING",
        code: "U",
        arg: "string1",
        proto: 1,
        dispatch: pickle._push
    },
    N: {
        name: "NONE",
        code: "N",
        arg: null,
        proto: 0,
        dispatch: pickle._push
    },
    "": {
        name: "NEWTRUE",
        code: "",
        arg: null,
        proto: 2,
        dispatch: function(stack, arg) {
            stack.push(new pickle.container(true));
        }
    },
    "": {
        name: "NEWFALSE",
        code: "",
        arg: null,
        proto: 2,
        dispatch: function(stack, arg) {
            stack.push(new pickle.container(false));
        }
    },
    V: {
        name: "UNICODE",
        code: "V",
        arg: "unicodestringnl",
        proto: 0,
        dispatch: pickle._push
    },
    X: {
        name: "BINUNICODE",
        code: "X",
        arg: "unicodestring4",
        proto: 1,
        dispatch: pickle._push
    },
    F: {
        name: "FLOAT",
        code: "F",
        arg: "floatnl",
        proto: 0,
        dispatch: pickle._push
    },
    G: {
        name: "BINFLOAT",
        code: "G",
        arg: "float8",
        proto: 1,
        dispatch: pickle._push
    },
    "]": {
        name: "EMPTY_LIST",
        code: "]",
        arg: null,
        proto: 1,
        dispatch: function(stack, arg) {
            stack.push(new pickle.container([]));
        }
    },
    a: {
        name: "APPEND",
        code: "a",
        arg: null,
        proto: 0,
        dispatch: function(stack, arg) {
            val = stack.popLast().value;
            stack.last().value.push(val);
        }
    },
    e: {
        name: "APPENDS",
        code: "e",
        arg: null,
        proto: 1,
        dispatch: function(stack, arg) {
            mark = pickle.mark(stack);
            list = mark.prev().value;
            limit = mark.next();
            while (item = mark.next()) {
                list.push(item.value);
                stack.remove(item);
            }
            stack.remove(limit);
        }
    },
    l: {
        name: "LIST",
        code: "l",
        arg: null,
        proto: 0,
        dispatch: function(stack, arg) {
            mark = pickle.mark(stack);
            list = [];
            limit = mark.current();
            while (item = mark.next()) {
                list.push(item.value);
            }
            stack.replace(limit, new pickle.container(list));
        }
    },
    ")": {
        name: "EMPTY_TUPLE",
        code: ")",
        arg: null,
        proto: 1,
        dispatch: function(stack, arg) {
            stack.push(new pickle.container([]));
        }
    },
    t: {
        name: "TUPLE",
        code: "t",
        arg: null,
        proto: 0,
        dispatch: function(stack, arg) {
            mark = pickle.mark(stack);
            list = [];
            limit = mark.current();
            while (item = mark.next()) {
                list.push(item.value);
                stack.remove(item);
            }
            stack.replace(limit, new pickle.container(list));
        }
    },
    "": {
        name: "TUPLE1",
        code: "",
        arg: null,
        proto: 2,
        dispatch: function(stack, arg) {
            var last = stack.last();
            stack.push(new pickle.container([ last.value ]));
            stack.remove(last);
        }
    },
    "": {
        name: "TUPLE2",
        code: "",
        arg: null,
        proto: 2,
        dispatch: function(stack, arg) {
            var list = [], iter = stack.getIter(), item = null, count = 2;
            while (count-- > 0 && (item = iter.prev())) {
                list[count] = item.value;
                if (count != 0) stack.remove(item);
            }
            stack.replace(item, new pickle.container(list));
        }
    },
    "": {
        name: "TUPLE3",
        code: "",
        arg: null,
        proto: 2,
        dispatch: function(stack, arg) {
            var list = [], iter = stack.getIter(), item = null, count = 3;
            while (count-- > 0 && (item = iter.prev())) {
                list[count] = item.value;
                if (count != 0) stack.remove(item);
            }
            stack.replace(item, new pickle.container(list));
        }
    },
    "}": {
        name: "EMPTY_DICT",
        code: "}",
        arg: null,
        proto: 1,
        dispatch: function(stack, arg) {
            stack.push(new pickle.container({}));
        }
    },
    d: {
        name: "DICT",
        code: "d",
        arg: null,
        proto: 0,
        dispatch: function(stack, arg) {
            var mark = pickle.mark(stack), d = {}, limit = mark.current();
            while (item = mark.next()) {
                key = item;
                value = mark.next();
                stack.remove(key);
                stack.remove(value);
                d[key.value] = value.value;
            }
            stack.replace(limit, new pickle.container(d));
        }
    },
    s: {
        name: "SETITEM",
        code: "s",
        arg: null,
        proto: 0,
        dispatch: function(stack, arg) {
            value = stack.popLast().value;
            key = stack.popLast().value;
            dict = stack.last().value;
            dict[key] = value;
        }
    },
    u: {
        name: "SETITEMS",
        code: "u",
        arg: null,
        proto: 1,
        dispatch: function(stack, arg) {
            mark = pickle.mark(stack);
            limit = mark.current();
            dict = mark.prev().value;
            mark.next();
            while (item = mark.next()) {
                key = item;
                value = mark.next();
                dict[key.value] = value.value;
                stack.remove(key);
                stack.remove(value);
            }
            stack.remove(limit);
        }
    },
    "0": {
        name: "POP",
        code: "0",
        arg: null,
        proto: 0,
        dispatch: function(stack, arg) {
            stack.popLast();
        }
    },
    "2": {
        name: "DUP",
        code: "2",
        arg: null,
        proto: 0,
        dispatch: function(stack, arg) {
            stack.push(stack.last());
        }
    },
    "(": {
        name: "MARK",
        code: "(",
        arg: null,
        proto: 0,
        dispatch: function(stack, arg) {
            stack.push(new pickle.marker());
        }
    },
    "1": {
        name: "POP_MARK",
        code: "1",
        arg: null,
        proto: 1,
        dispatch: function(stack, arg) {
            var mark = pickle.mark(stack);
            stack.remove(mark.current());
            while (item = mark.next()) {
                stack.remove(item);
            }
        }
    },
    g: {
        name: "GET",
        code: "g",
        arg: "stringnl_noescape",
        proto: 0,
        dispatch: function(stack, arg, memo) {
            stack.push(memo[arg]);
        }
    },
    h: {
        name: "BINGET",
        code: "h",
        arg: "uint1",
        proto: 1,
        dispatch: function(stack, arg, memo) {
            stack.push(memo[arg]);
        }
    },
    j: {
        name: "LONG_BINGET",
        code: "j",
        arg: "int4",
        proto: 1,
        dispatch: function(stack, arg, memo) {
            stack.push(memo[arg]);
        }
    },
    p: {
        name: "PUT",
        code: "p",
        arg: "stringnl_noescape",
        proto: 0,
        dispatch: function(stack, arg, memo) {
            memo[arg] = stack.last();
        }
    },
    q: {
        name: "BINPUT",
        code: "q",
        arg: "uint1",
        proto: 1,
        dispatch: function(stack, arg, memo) {
            memo[arg] = stack.last();
        }
    },
    r: {
        name: "LONG_BINPUT",
        code: "r",
        arg: "int4",
        proto: 1,
        dispatch: function(stack, arg, memo) {
            memo[arg] = stack.last();
        }
    },
    "": {
        name: "EXT1",
        code: "",
        arg: "uint1",
        proto: 2,
        dispatch: function(stack, arg, memo) {
            throw new Error("Unsupported opcode EXT1(" + arg + ")");
        }
    },
    "": {
        name: "EXT2",
        code: "",
        arg: "uint2",
        proto: 2,
        dispatch: function(stack, arg, memo) {
            throw new Error("Unsupported opcode EXT2(" + arg + ")");
        }
    },
    "": {
        name: "EXT4",
        code: "",
        arg: "int4",
        proto: 2,
        dispatch: function(stack, arg, memo) {
            throw new Error("Unsupported opcode EXT4(" + arg + ")");
        }
    },
    c: {
        name: "GLOBAL",
        code: "c",
        arg: "stringnl_noescape_pair",
        proto: 0,
        dispatch: function(stack, arg, memo) {
            stack.push(new pickle.container(pickle.findClass(arg[0], arg[1])));
        }
    },
    R: {
        name: "REDUCE",
        code: "R",
        arg: null,
        proto: 0,
        dispatch: function(stack, arg, memo) {
            var arg = stack.popLast().value, value = stack.last().value.apply(this, arg.constructor === Array ? arg : [ arg ]);
            stack.replace(stack.last(), new pickle.container(value));
        }
    },
    b: {
        name: "BUILD",
        code: "b",
        arg: null,
        proto: 0,
        dispatch: function(stack, arg, memo) {
            throw new Error("Unsupported opcode BUILD");
        }
    },
    i: {
        name: "INST",
        code: "i",
        arg: "stringnl_noescape_pair",
        proto: 0,
        dispatch: function(stack, arg, memo) {
            throw new Error("Unsupported opcode INST(" + JSON.stringify(arg) + ")");
        }
    },
    o: {
        name: "OBJ",
        code: "o",
        arg: null,
        proto: 1,
        dispatch: function(stack, arg, memo) {
            throw new Error("Unsupported opcode OBJ");
        }
    },
    "": {
        name: "NEWOBJ",
        code: "",
        arg: null,
        proto: 2,
        dispatch: function(stack, arg, memo) {
            throw new Error("Unsupported opcode NEWOBJ");
        }
    },
    "": {
        name: "PROTO",
        code: "",
        arg: "uint1",
        proto: 2,
        dispatch: function(stack, arg, memo) {
            if (arg > 2) throw new Error("Unsupported protocol " + arg);
        }
    },
    ".": {
        name: "STOP",
        code: ".",
        arg: null,
        proto: 0,
        dispatch: function(stack, arg, memo) {
            return stack.popLast().value;
        }
    },
    P: {
        name: "PERSID",
        code: "P",
        arg: "stringnl_noescape",
        proto: 0,
        dispatch: function(stack, arg, memo) {
            throw new Error("Unsupported opcode PERSID(" + arg + ")");
        }
    },
    Q: {
        name: "BINPERSID",
        code: "Q",
        arg: null,
        proto: 1,
        dispatch: function(stack, arg, memo) {
            throw new Error("Unsupported opcode BINPERSID");
        }
    }
};

pickle.linkedList = function() {
    this.id = pickle.linkedList.idCounter++;
    this.iter = new pickle.linkedList.iterator(this);
};

pickle.linkedList.idCounter = 0;

pickle.linkedList.prototype = {
    start: null,
    end: null,
    length: 0,
    id: 0,
    empty: function() {
        return this.length == 0;
    },
    push: function(obj) {
        var item = {
            previous: null,
            next: null,
            content: obj
        };
        if (!obj.__llReferences) obj.__llReferences = {};
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
    pop: function() {
        if (this.start == null) throw new Error("List is empty");
        var content = this.start.content;
        this.remove(this.start.content);
        return content;
    },
    popLast: function() {
        if (this.end == null) throw new Error("List is empty");
        var content = this.end.content;
        this.remove(this.end.content);
        return content;
    },
    replace: function(original, replaced) {
        if (!original.__llReferences) original.__llReferences = {};
        original = original.__llReferences[this.id];
        if (!original) throw new Error("Trying to replace undefined item");
        if (!replaced.__llReferences) replaced.__llReferences = {};
        delete original.content.__llReferences[this.id];
        replaced.__llReferences[this.id] = original;
        original.content = replaced;
    },
    insert: function(after, obj) {
        var item = {
            previous: null,
            next: null,
            content: obj
        };
        if (!obj.__llReferences) obj.__llReferences = {};
        obj.__llReferences[this.id] = item;
        if (after) {
            if (!after.__llReferences) after.__llReferences = {};
            after = after.__llReferences[this.id];
            if (!after) throw new Error("Trying to insert after undefined item");
        }
        item.previous = after;
        item.next = after != null ? after.next : null;
        this.length++;
        if (after == null) {
            item.next = this.start;
            if (this.start != null) this.start.previous = item;
            this.start = item;
            if (this.end == null) this.end = this.start;
            return item;
        }
        if (after.next != null) {
            after.next.previous = item;
        }
        after.next = item;
        if (after == this.end) {
            this.end = item;
        }
        return item;
    },
    remove: function(obj) {
        var item = obj.__llReferences ? obj.__llReferences[this.id] : null;
        if (item === undefined || item == null) throw new Error("Item to be removed was not specified");
        delete obj.__llReferences[this.id];
        if (this.start == null || this.end == null) return false;
        this.length--;
        if (item == this.end && item == this.start) {
            this.end = null;
            this.start = null;
            return true;
        }
        if (item == this.end) {
            this.end = this.end.previous;
            if (this.end != null) this.end.next = null;
            return true;
        }
        if (item == this.start) {
            this.start = item.next;
            if (this.start != null) this.start.previous = null;
            return true;
        }
        item.previous.next = item.next;
        item.next.previous = item.previous;
        return true;
    },
    each: function(callback) {
        var current = this.start, index = 0;
        while (current != null) {
            if (callback(current.content, current, index)) break;
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
        var iter = this.getIter(), str = "[";
        while (item = iter.next()) {
            var val = item.toString();
            if (val.length > 44) val = val.substr(0, 40) + "...";
            if (item.constructor === Array) {
                str += "a(" + val + "),";
            } else {
                str += val + ",";
            }
        }
        if (str.substr(str.length - 1, 1) == ",") str = str.substr(0, str.length - 1);
        str += "]";
        return str;
    }
};

pickle.linkedList.iterator = function(ll) {
    this.ll = ll;
};

pickle.linkedList.iterator.prototype = {
    point: null,
    reset: function() {
        this.point = null;
    },
    current: function() {
        return this.point ? this.point.content : null;
    },
    prev: function() {
        if (this.point == null) this.point = this.ll.lastItem(); else this.point = this.point.previous;
        return this.current();
    },
    next: function() {
        if (this.point == null) this.point = this.ll.firstItem(); else this.point = this.point.next;
        return this.current();
    }
};

wot.player = function() {
    this.construct.apply(this, arguments);
};

wot.player.prototype = {
    replay: null,
    clock: 0,
    lastClock: -1,
    state: "stopped",
    onPacket: null,
    onVehiclePosition: null,
    onVehicleRotation: null,
    onVehicleHealth: null,
    onVehicleTurretRotation: null,
    onVehicleSpotted: null,
    onVehicleUnspotted: null,
    onVehicleDamaged: null,
    construct: function(replay) {
        this.onPacket = new wot.player.event();
        this.onVehicleRoster = new wot.player.event();
        this.onVehiclePosition = new wot.player.event();
        this.onVehicleRotation = new wot.player.event();
        this.onVehicleHealth = new wot.player.event();
        this.onVehicleKilled = new wot.player.event();
        this.onVehicleTurretRotation = new wot.player.event();
        this.onVehicleGunRotation = new wot.player.event();
        this.onVehicleSpotted = new wot.player.event();
        this.onVehicleUnspotted = new wot.player.event();
        this.onVehicleDamaged = new wot.player.event();
        this.onCameraPosition = new wot.player.event();
        this.onCrossPosition = new wot.player.event();
        this.onMessage = new wot.player.event();
        this.setReplay(replay);
    },
    setReplay: function(replay) {
        this.replay = replay;
    },
    seek: function(clock) {
        if (clock < this.clock) {
            this.clock = 0;
            this.lastClock = -1;
        }
        while (this.clock < clock) {
            this.tick(1);
        }
    },
    tick: function(clock_incerase) {
        var packets = [], vehicleUpdates = {}, cameraUpdate = [], crossUpdate = [];
        for (var i = Math.floor(this.lastClock); i <= Math.floor(this.clock); i++) {
            packets.push.apply(packets, this.replay.getPackets(i));
        }
        for (var i = 0, l = packets.length; i < l; i++) {
            var packet = packets[i];
            if (packet.clock <= this.lastClock) continue;
            if (packet.clock > this.clock) continue;
            this.onPacket.fire(this, packet);
            switch (packet.ident) {
              case "vehicle_unspotted":
                this.onVehicleUnspotted.fire(this, packet.playerId);
                break;

              case "vehicle_spotted":
                this.onVehicleSpotted.fire(this, packet.playerId);
                this.onVehicleHealth.fire(this, packet.health);
                break;

              case "turret_rotation":
                var next = this.nextPacket(packet.clock, packet.type, {
                    subType: packet.subType,
                    playerId: packet.playerId
                });
                this.onVehicleTurretRotation.fire(this, packet.playerId, packet.turretRotation, next ? next.turretRotation : packet.turretRotation, next ? next.clock - packet.clock : 0);
                this.onVehicleGunRotation.fire(this, packet.playerId, packet, next ? next : packet, next ? next.clock - packet.clock : 0);
                break;

              case "vehicle_health":
                this.onVehicleHealth.fire(this, packet.playerId, packet.health);
                break;

              case "vehicle_killed":
                this.onVehicleKilled.fire(this, packet.playerId);
                break;

              case "vehicle_damaged":
                this.onVehicleDamaged.fire(this, packet.playerId, packet.source, packet.health);
                this.onVehicleHealth.fire(this, packet.playerId, packet.health);
                if (packet.health <= 0) this.onVehicleKilled.fire(this, packet.playerId, packet.source);
                break;

              case "roster":
                if (packet.roster) {
                    for (var i = 0; i < packet.roster.length; i++) {
                        this.onVehicleRoster.fire(this, packet.roster[i][0], packet.roster[i]);
                    }
                }
                break;

              case "vehicle_position_rotation":
                var next = this.nextPacket(packet.clock, packet.type, {
                    playerId: packet.playerId
                });
                if (vehicleUpdates[packet.playerId]) {
                    vehicleUpdates[packet.playerId][1] = next ? next : packet;
                } else {
                    vehicleUpdates[packet.playerId] = [ packet, next ? next : packet ];
                }
                break;

              case "recticle_position":
                var next = this.nextPacket(packet.clock, packet.type);
                if (!next) next = packet;
                if (crossUpdate.length > 0) {
                    if (next.clock > crossUpdate[1].clock) crossUpdate[1] = next;
                } else {
                    crossUpdate = [ packet, next ];
                }
                break;

              case "camera_position":
                var next = this.nextPacket(packet.clock, packet.type);
                if (!next) next = packet;
                if (cameraUpdate.length > 0) {
                    if (next.clock > cameraUpdate[1].clock) cameraUpdate[1] = next;
                } else {
                    cameraUpdate = [ packet, next ];
                }
                break;

              case "message":
                this.onMessage.fire(this, packet.message);
                break;
            }
        }
        if (crossUpdate.length > 0) {
            var packet = crossUpdate[0], next = crossUpdate[1];
            this.onCrossPosition.fire(this, packet, next, packet.clock, next.clock - packet.clock);
        }
        if (cameraUpdate.length > 0) {
            var packet = cameraUpdate[0], next = cameraUpdate[1];
            this.onCameraPosition.fire(this, packet.position, packet.rotation, next.position, next.rotation, packet.clock, next.clock - packet.clock);
        }
        for (var i in vehicleUpdates) {
            var packet = vehicleUpdates[i][0], next = vehicleUpdates[i][1];
            this.onVehiclePosition.fire(this, i, packet.position, next.position, packet.clock, next.clock - packet.clock);
            this.onVehicleRotation.fire(this, i, packet.hullRotation, next.hullRotation, packet.clock, next.clock - packet.clock);
        }
        this.lastClock = this.clock;
        this.clock += clock_incerase;
    },
    nextPacket: function(clock, type, params) {
        var from = clock;
        while (clock < this.replay.maxClock) {
            var packets = this.replay.getPackets(Math.floor(clock));
            for (var i = 0, l = packets.length; i < l; i++) {
                if (packets[i].clock <= from || packets[i].type != type) continue;
                var match = true;
                for (var p in params) {
                    if (packets[i][p] != params[p]) {
                        match = false;
                        break;
                    }
                }
                if (match) return packets[i];
            }
            clock += 1;
        }
        return null;
    }
};

wot.player.event = function() {
    this.construct.apply(this, arguments);
};

wot.player.event.prototype = {
    listeners: null,
    construct: function() {
        this.listeners = [];
    },
    attach: function(handler) {
        this.listeners.push(handler);
    },
    remove: function(handler) {
        var index = this.listeners.indexOf(handler);
        if (index != -1) {
            this.listeners.splice(index, 1);
        }
    },
    fire: function(scope) {
        var args = [];
        Array.prototype.push.apply(args, arguments);
        args.shift();
        for (var i = 0; i < this.listeners.length; i++) {
            this.listeners[i].apply(scope, args);
        }
    }
};

if (typeof wot === "undefined") wot = {};

wot.replay = function() {
    this.construct.apply(this, arguments);
};

wot.replay.prototype = {
    frames: null,
    maxClock: null,
    battleStart: null,
    mainPlayerName: null,
    mainPlayerId: null,
    raw: null,
    begin: null,
    end: null,
    packets: null,
    blocks: null,
    construct: function() {},
    setBlocks: function(blocks) {
        this.blocks = blocks;
        this.begin = this.blocks[0];
        if (this.blocks.length > 2) this.end = this.blocks[1];
        this.raw = this.blocks[this.blocks.length - 1];
    },
    getRoster: function() {
        for (var i = 0; i < this.packets.length; i++) {
            var packet = this.packets[i];
            if (packet.roster && packet.roster.length == 30 && packet.roster[0].length > 2) {
                var roster = {};
                for (var i in packet.roster) roster[packet.roster[i][0]] = packet.roster[i];
                return roster;
            }
        }
        return null;
    },
    setPackets: function(packets) {
        this.packets = packets;
        this.frames = {};
        for (var i = 0, l = this.packets.length; i < l; i++) {
            var packet = this.packets[i];
            var clock = Math.floor(packet.clock);
            if (!this.frames[clock]) this.frames[clock] = [];
            this.frames[clock].push(packet);
            if (packet.clock > this.maxClock) this.maxClock = packet.clock;
            if (packet.ident == "game_state") {
                this.battleStart = packet.clock;
            }
        }
    },
    getPlayerTeam: function() {
        return this.begin.vehicles[this.getMainPlayerId()].team;
    },
    getMainPlayerId: function() {
        if (!this.mainPlayerName) {
            this.mainPlayerName = this.begin.playerName;
        }
        if (this.mainPlayerId == null) {
            for (var id in this.begin.vehicles) {
                if (this.begin.vehicles[id].name == this.mainPlayerName) return id;
            }
        }
        return this.mainPlayerId;
    },
    getPackets: function(clock) {
        return this.frames[clock] ? this.frames[clock] : [];
    },
    getPacketsIn: function(from, to) {
        var found = [];
        for (var i = 0, l = this.packets.length; i < l; i++) {
            var packet = this.packets[i];
            if (packet.clock >= from && packet.clock <= to) {
                found.push(packet);
            }
        }
        return found;
    },
    getMap: function() {
        return this.begin.mapName;
    },
    getVehicle: function(vehicle_id) {
        return this.begin.vehicles[vehicle_id] ? this.begin.vehicles[vehicle_id] : null;
    },
    getVehicles: function() {
        return this.begin.vehicles;
    },
    get2DCoords: function(point, target_width, target_height) {
        var box = this.data.map.boundingBox;
        return [ (point[0] - box[0]) / (box[2] - box[0]) * target_width, (point[2] - box[1]) / (box[3] - box[1]) * target_height, point[1] ];
    },
    getPlayerPackets: function(player) {
        var result = [];
        for (var i = 0, l = this.packets.length; i < l; i++) {
            var packet = this.packets[i];
            if (packet.playerId && packet.playerId == player) {
                result.push(packet);
            }
        }
        return result;
    },
    getPacketsByType: function(type, subtype) {
        var result = [];
        for (var i = 0, l = this.packets.length; i < l; i++) {
            var packet = this.packets[i];
            if (packet.type == type && (typeof subtype === "undefined" || packet.subType == subtype)) {
                result.push(packet);
            }
        }
        return result;
    },
    getPacketsByIdent: function(ident) {
        var result = [];
        for (var i = 0, l = this.packets.length; i < l; i++) {
            var packet = this.packets[i];
            if (packet.ident == ident) {
                result.push(packet);
            }
        }
        return result;
    },
    getTypes: function(packets) {
        if (!packets) packets = this.packets;
        var result = {};
        for (var i = 0, l = packets.length; i < l; i++) {
            var packet = packets[i];
            if (!result[packet.type]) {
                result[packet.type] = {
                    count: 1,
                    packets: [ packet ],
                    sizes: [ packet.length ]
                };
            } else {
                var found = result[packet.type].sizes.indexOf(packet.length);
                if (found == -1) result[packet.type].sizes.push(packet.length);
                result[packet.type].count += 1;
                result[packet.type].packets.push(packet);
            }
        }
        return result;
    }
};

wot.replay.parser = function() {};

wot.replay.parser.prototype = {
    DB_COUNT_OFFSET: 4,
    DB_DATA_OFFSET: 8,
    BF_BLOCKSIZE: 8,
    BF_KEY: "DE72BEA0DE04BEB1DEFEBEEFDEADBEEF",
    parse: function(array_buffer) {
        var view = new DataView(array_buffer), replay = new wot.replay();
        pickle.modules["_BWp"] = {
            Array: function() {
                var a = [];
                for (var i = 0; i < arguments.length; i++) a.push(arguments[i]);
                return a;
            }
        };
        replay.setBlocks(this.readBlocks(view));
        replay.begin = JSON.parse(this.ab2str(replay.begin));
        if (replay.end) replay.end = JSON.parse(this.ab2str(replay.end));
        MAIN_REPLAY = replay;
        replay.raw_zip = this.decrypt(replay.raw);
        replay.raw_dec = this.decompress(replay.raw_zip);
        replay.raw = replay.raw_dec;
        replay.setPackets(this.readPackets(replay.raw));
        return replay;
    },
    ab2str: function(buf, length) {
        if (typeof length === "undefined") return String.fromCharCode.apply(null, new Uint8Array(buf));
        var str = String.fromCharCode.apply(null, new Uint8Array(buf));
        for (var i = str.length; i < length; i++) str += String.fromCharCode(0);
        return str;
    },
    str2ab: function(str) {
        var buff = new ArrayBuffer(str.length), view = new Uint8Array(buff), i = 0;
        for (i = 0; i < str.length; i += 1) {
            if (str.charCodeAt(i) > 255) throw new Error(i + " too big: " + str.charCodeAt(i) + "( " + str.length + ")");
            view[i] = str.charCodeAt(i);
        }
        return buff;
    },
    readPackets: function(data) {
        var reader = new wot.replay.packet.reader(data), packets = [];
        while (reader.hasNext()) packets.push(reader.next());
        return packets;
    },
    decrypt: function(data) {
        var key = [];
        for (var i = 0; i < this.BF_KEY.length; i += 2) {
            key.push(parseInt(this.BF_KEY.substr(i, 2), 16));
        }
        var bf = new jsbfsh.context(key), padding = this.BF_BLOCKSIZE - data.byteLength % this.BF_BLOCKSIZE, previous = new Uint8Array(this.BF_BLOCKSIZE), result = new ArrayBuffer(data.byteLength + padding), view = new Uint8Array(result);
        for (var i = 0; i < this.BF_BLOCKSIZE; i++) previous[i] = 0;
        for (var i = 0; i < data.byteLength; i += this.BF_BLOCKSIZE) {
            var block = new Uint8Array(data.slice(i, i + this.BF_BLOCKSIZE));
            if (block.length < this.BF_BLOCKSIZE) {
                var v = new Uint8Array(this.BF_BLOCKSIZE);
                for (var n = 0; n < this.BF_BLOCKSIZE; n++) v[n] = block[n];
                block = v;
            }
            jsbfsh.decrypt(bf, block, [ 0, 0, 0, 0, 0, 0, 0, 0 ]);
            for (var x = 0; x < this.BF_BLOCKSIZE; x++) {
                block[x] = previous[x] ^ block[x];
                previous[x] = block[x];
                view[i + x] = block[x];
            }
        }
        return result.slice(0, data.byteLength);
    },
    decompress: function(data) {
        var result = pako.inflate(new Uint8Array(data)), buff = new ArrayBuffer(result.length), view = new Uint8Array(buff);
        for (var i = 0; i < result.length; i++) view[i] = result[i];
        return buff;
    },
    readBlocks: function(view) {
        var blocks = [], count = view.getUint32(this.DB_COUNT_OFFSET, true), offset = this.DB_DATA_OFFSET;
        for (var i = 0; i < count; i++) {
            var size = view.getUint32(offset, true), block_offset = offset + 4;
            blocks.push(view.buffer.slice(block_offset, block_offset + size));
            offset = block_offset + size;
        }
        blocks.push(view.buffer.slice(offset + 8));
        return blocks;
    }
};

wot.replay.packet = function() {
    this.construct.apply(this, arguments);
};

wot.replay.packet.prototype = {
    construct: function(data) {
        this.view = new DataView(data);
        this.data = data;
        this.length = data.byteLength;
        this.type = this.view.getUint32(4, true);
        if (this.length > 8) {
            this.clock = this.view.getFloat32(8, true);
        }
        if (this.types[this.type]) this.types[this.type].apply(this, [ this.view ]);
    }
};

wot.replay.packet.reader = function(data) {
    this.data = data;
    this.view = new DataView(data);
};

wot.replay.packet.reader.prototype = {
    BASE_PACKET_SIZE: 12,
    position: 0,
    next: function() {
        var payload_size = this.view.getInt32(this.position, true), packet_size = payload_size + this.BASE_PACKET_SIZE;
        if (this.position + packet_size > this.data.byteLength) throw new Error("Packet outside bounds!");
        var packet = new wot.replay.packet(this.data.slice(this.position, this.position + packet_size));
        packet.bytePosition = this.position;
        this.previous = this.position;
        this.position += packet_size;
        return packet;
    },
    hasNext: function() {
        return !(this.position >= this.data.byteLength);
    }
};

wot.replay.packet.prototype.decodeAngle = function(code, bits) {
    return Math.PI * 2 * code / (1 << bits) - Math.PI;
};

wot.replay.packet.prototype.types = {
    0: function(u) {
        this.playerAltID = u.getUint32(12, true);
        this.playerName = "";
        var length = Math.min(u.getUint32(19), this.length - 23);
        for (var i = 0; i < length; i++) {
            this.playerName += String.fromCharCode(u.getUint8(23 + i, true));
        }
    },
    3: function(u) {
        this.playerId = u.getUint32(12, true);
    },
    4: function(u) {
        this.ident = "vehicle_unspotted";
        this.playerId = u.getUint32(12, true);
    },
    5: function(u) {
        this.ident = "vehicle_spotted";
        this.playerId = u.getUint32(12, true);
        if (u.byteLength > 63 + 2) {
            this.health = u.getUint16(63, true);
            if (this.health > 2e4) this.health = 0;
        }
    },
    7: function(u) {
        this.playerId = u.getUint32(12, true);
        this.subType = u.getUint32(16, true);
        switch (this.subType) {
          case 2:
          case 3:
            if (this.length >= 26) {
                this.ident = "turret_rotation";
                this.code = u.getInt16(24, true);
                this.turretRotation = this.decodeAngle(this.code >> 6 & 1023, 10);
                this.getGunRotation = function(min, max) {
                    return min + (this.code & 63) / ((1 << 6) - 1) * (max - min);
                };
            }
            break;

          case 4:
            if (this.length >= 26) {
                this.ident = "vehicle_health";
                this.health = u.getUint16(24, true);
                if (this.health > 2e4) this.health = 0;
            }
            break;

          case 4:
            break;

          case 6:
            break;

          case 9:
            this.ident = "vehicle_killed";
            break;
        }
    },
    8: function(u) {
        this.playerId = u.getUint32(12, true);
        this.subType = u.getUint32(16, true);
        switch (this.subType) {
          case 0:
            this.ident = "shot_fired";
            break;

          case 1:
            this.ident = "vehicle_damaged";
            this.health = u.getInt16(24, true);
            if (this.health < 0) this.health = 0;
            this.source = u.getUint32(26, true);
            break;

          case 6:
            this.ident = "shot_bounced";
            break;

          case 7:
            this.ident = "shot_penetrated";
            this.source = u.getUint32(24, true);
            break;

          case 40:
          case 41:
            try {
                this.roster = pickle.load(wot.replay.parser.prototype.decompress(u.buffer.slice(29)));
                this.ident = "roster";
            } catch (e) {}
            break;

          case 30:
            try {
                this.roster = pickle.load(u.buffer.slice(29));
                this.ident = "roster";
            } catch (e) {}
            break;
        }
    },
    10: function(u) {
        this.ident = "vehicle_position_rotation";
        this.position = [];
        this.hullRotation = [];
        this.playerId = u.getUint32(12, true);
        this.position[0] = u.getFloat32(20, true);
        this.position[1] = u.getFloat32(24, true);
        this.position[2] = u.getFloat32(28, true);
        this.hullRotation[0] = u.getFloat32(44, true);
        this.hullRotation[1] = u.getFloat32(48, true);
        this.hullRotation[2] = u.getFloat32(52, true);
    },
    22: function(u) {
        this.ident = "game_state";
        this.gameState = u.getUint32(12, true);
    },
    26: function(u) {
        this.currentPosition = [];
        this.currentRadius = 0;
        this.targetPosition = [];
        this.targetRotation = [];
        this.targetRadius = 0;
        this.ident = "recticle_position";
        this.targetPosition[0] = u.getFloat32(12, true);
        this.targetPosition[1] = u.getFloat32(16, true);
        this.targetPosition[2] = u.getFloat32(20, true);
        this.targetRadius = u.getFloat32(24, true);
        this.currentPosition[0] = u.getFloat32(28, true);
        this.currentPosition[1] = u.getFloat32(32, true);
        this.currentPosition[2] = u.getFloat32(36, true);
        this.targetRotation[0] = u.getFloat32(40, true);
        this.targetRotation[1] = u.getFloat32(44, true);
        this.targetRotation[2] = u.getFloat32(48, true);
        this.currentRadius = u.getFloat32(52, true);
    },
    38: function(u) {
        this.position = [];
        this.rotation = [ 0, 0, 0 ];
        this.ident = "camera_position";
        this.rotation[0] = u.getFloat32(12, true);
        this.rotation[1] = u.getFloat32(16, true);
        this.rotation[2] = u.getFloat32(20, true);
        this.rotation[3] = u.getFloat32(24, true);
        this.position[0] = u.getFloat32(28, true);
        this.position[1] = u.getFloat32(32, true);
        this.position[2] = u.getFloat32(36, true);
    },
    24: function(u) {
        this.angle = u.getFloat32(12, true);
    },
    25: function(u) {
        this.angle = u.getFloat32(12, true);
    },
    27: function(u) {
        this.angle = u.getFloat32(12, true);
    },
    30: function(u) {
        this.playerId = u.getUint32(12, true);
    },
    35: function(u) {
        var c = u.getUint32(12, true);
        this.message = "";
        this.ident = "message";
        for (var i = 0; i < c; i++) this.message += String.fromCharCode(u.getUint8(16 + i));
    }
};
//# sourceMappingURL=../../dist/wot.js.map