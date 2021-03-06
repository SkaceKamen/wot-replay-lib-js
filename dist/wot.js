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

jsbfsh = {
    val: function() {
        this.v = 0;
    },
    rounds: function(c, l, r, i, d) {
        var n = 16, t;
        while (n--) {
            l.v ^= c.p[i += d];
            t = c.s[0][l.v >> 24 & 255];
            t += c.s[1][l.v >> 16 & 255];
            t ^= c.s[2][l.v >> 8 & 255];
            r.v ^= t + c.s[3][l.v & 255];
            t = r.v;
            r.v = l.v;
            l.v = t;
        }
        l.v = r.v ^ c.p[i + d + d];
        r.v = t ^ c.p[i + d];
    },
    context: function(k) {
        this.p = [ 608135816, 2242054355, 320440878, 57701188, 2752067618, 698298832, 137296536, 3964562569, 1160258022, 953160567, 3193202383, 887688300, 3232508343, 3380367581, 1065670069, 3041331479, 2450970073, 2306472731 ];
        this.s = [ [ 3509652390, 2564797868, 805139163, 3491422135, 3101798381, 1780907670, 3128725573, 4046225305, 614570311, 3012652279, 134345442, 2240740374, 1667834072, 1901547113, 2757295779, 4103290238, 227898511, 1921955416, 1904987480, 2182433518, 2069144605, 3260701109, 2620446009, 720527379, 3318853667, 677414384, 3393288472, 3101374703, 2390351024, 1614419982, 1822297739, 2954791486, 3608508353, 3174124327, 2024746970, 1432378464, 3864339955, 2857741204, 1464375394, 1676153920, 1439316330, 715854006, 3033291828, 289532110, 2706671279, 2087905683, 3018724369, 1668267050, 732546397, 1947742710, 3462151702, 2609353502, 2950085171, 1814351708, 2050118529, 680887927, 999245976, 1800124847, 3300911131, 1713906067, 1641548236, 4213287313, 1216130144, 1575780402, 4018429277, 3917837745, 3693486850, 3949271944, 596196993, 3549867205, 258830323, 2213823033, 772490370, 2760122372, 1774776394, 2652871518, 566650946, 4142492826, 1728879713, 2882767088, 1783734482, 3629395816, 2517608232, 2874225571, 1861159788, 326777828, 3124490320, 2130389656, 2716951837, 967770486, 1724537150, 2185432712, 2364442137, 1164943284, 2105845187, 998989502, 3765401048, 2244026483, 1075463327, 1455516326, 1322494562, 910128902, 469688178, 1117454909, 936433444, 3490320968, 3675253459, 1240580251, 122909385, 2157517691, 634681816, 4142456567, 3825094682, 3061402683, 2540495037, 79693498, 3249098678, 1084186820, 1583128258, 426386531, 1761308591, 1047286709, 322548459, 995290223, 1845252383, 2603652396, 3431023940, 2942221577, 3202600964, 3727903485, 1712269319, 422464435, 3234572375, 1170764815, 3523960633, 3117677531, 1434042557, 442511882, 3600875718, 1076654713, 1738483198, 4213154764, 2393238008, 3677496056, 1014306527, 4251020053, 793779912, 2902807211, 842905082, 4246964064, 1395751752, 1040244610, 2656851899, 3396308128, 445077038, 3742853595, 3577915638, 679411651, 2892444358, 2354009459, 1767581616, 3150600392, 3791627101, 3102740896, 284835224, 4246832056, 1258075500, 768725851, 2589189241, 3069724005, 3532540348, 1274779536, 3789419226, 2764799539, 1660621633, 3471099624, 4011903706, 913787905, 3497959166, 737222580, 2514213453, 2928710040, 3937242737, 1804850592, 3499020752, 2949064160, 2386320175, 2390070455, 2415321851, 4061277028, 2290661394, 2416832540, 1336762016, 1754252060, 3520065937, 3014181293, 791618072, 3188594551, 3933548030, 2332172193, 3852520463, 3043980520, 413987798, 3465142937, 3030929376, 4245938359, 2093235073, 3534596313, 375366246, 2157278981, 2479649556, 555357303, 3870105701, 2008414854, 3344188149, 4221384143, 3956125452, 2067696032, 3594591187, 2921233993, 2428461, 544322398, 577241275, 1471733935, 610547355, 4027169054, 1432588573, 1507829418, 2025931657, 3646575487, 545086370, 48609733, 2200306550, 1653985193, 298326376, 1316178497, 3007786442, 2064951626, 458293330, 2589141269, 3591329599, 3164325604, 727753846, 2179363840, 146436021, 1461446943, 4069977195, 705550613, 3059967265, 3887724982, 4281599278, 3313849956, 1404054877, 2845806497, 146425753, 1854211946 ], [ 1266315497, 3048417604, 3681880366, 3289982499, 290971e4, 1235738493, 2632868024, 2414719590, 3970600049, 1771706367, 1449415276, 3266420449, 422970021, 1963543593, 2690192192, 3826793022, 1062508698, 1531092325, 1804592342, 2583117782, 2714934279, 4024971509, 1294809318, 4028980673, 1289560198, 2221992742, 1669523910, 35572830, 157838143, 1052438473, 1016535060, 1802137761, 1753167236, 1386275462, 3080475397, 2857371447, 1040679964, 2145300060, 2390574316, 1461121720, 2956646967, 4031777805, 4028374788, 33600511, 2920084762, 1018524850, 629373528, 3691585981, 3515945977, 2091462646, 2486323059, 586499841, 988145025, 935516892, 3367335476, 2599673255, 2839830854, 265290510, 3972581182, 2759138881, 3795373465, 1005194799, 847297441, 406762289, 1314163512, 1332590856, 1866599683, 4127851711, 750260880, 613907577, 1450815602, 3165620655, 3734664991, 3650291728, 3012275730, 3704569646, 1427272223, 778793252, 1343938022, 2676280711, 2052605720, 1946737175, 3164576444, 3914038668, 3967478842, 3682934266, 1661551462, 3294938066, 4011595847, 840292616, 3712170807, 616741398, 312560963, 711312465, 1351876610, 322626781, 1910503582, 271666773, 2175563734, 1594956187, 70604529, 3617834859, 1007753275, 1495573769, 4069517037, 2549218298, 2663038764, 504708206, 2263041392, 3941167025, 2249088522, 1514023603, 1998579484, 1312622330, 694541497, 2582060303, 2151582166, 1382467621, 776784248, 2618340202, 3323268794, 2497899128, 2784771155, 503983604, 4076293799, 907881277, 423175695, 432175456, 1378068232, 4145222326, 3954048622, 3938656102, 3820766613, 2793130115, 2977904593, 26017576, 3274890735, 3194772133, 1700274565, 1756076034, 4006520079, 3677328699, 720338349, 1533947780, 354530856, 688349552, 3973924725, 1637815568, 332179504, 3949051286, 53804574, 2852348879, 3044236432, 1282449977, 3583942155, 3416972820, 4006381244, 1617046695, 2628476075, 3002303598, 1686838959, 431878346, 2686675385, 1700445008, 1080580658, 1009431731, 832498133, 3223435511, 2605976345, 2271191193, 2516031870, 1648197032, 4164389018, 2548247927, 300782431, 375919233, 238389289, 3353747414, 2531188641, 2019080857, 1475708069, 455242339, 2609103871, 448939670, 3451063019, 1395535956, 2413381860, 1841049896, 1491858159, 885456874, 4264095073, 4001119347, 1565136089, 3898914787, 1108368660, 540939232, 1173283510, 2745871338, 3681308437, 4207628240, 3343053890, 4016749493, 1699691293, 1103962373, 3625875870, 2256883143, 3830138730, 1031889488, 3479347698, 1535977030, 4236805024, 3251091107, 2132092099, 1774941330, 1199868427, 1452454533, 157007616, 2904115357, 342012276, 595725824, 1480756522, 206960106, 497939518, 591360097, 863170706, 2375253569, 3596610801, 1814182875, 2094937945, 3421402208, 1082520231, 3463918190, 2785509508, 435703966, 3908032597, 1641649973, 2842273706, 3305899714, 1510255612, 2148256476, 2655287854, 3276092548, 4258621189, 236887753, 3681803219, 274041037, 1734335097, 3815195456, 3317970021, 1899903192, 1026095262, 4050517792, 356393447, 2410691914, 3873677099, 3682840055 ], [ 3913112168, 2491498743, 4132185628, 2489919796, 1091903735, 1979897079, 3170134830, 3567386728, 3557303409, 857797738, 1136121015, 1342202287, 507115054, 2535736646, 337727348, 3213592640, 1301675037, 2528481711, 1895095763, 1721773893, 3216771564, 62756741, 2142006736, 835421444, 2531993523, 1442658625, 3659876326, 2882144922, 676362277, 1392781812, 170690266, 3921047035, 1759253602, 3611846912, 1745797284, 664899054, 1329594018, 3901205900, 3045908486, 2062866102, 2865634940, 3543621612, 3464012697, 1080764994, 553557557, 3656615353, 3996768171, 991055499, 499776247, 1265440854, 648242737, 3940784050, 980351604, 3713745714, 1749149687, 3396870395, 4211799374, 3640570775, 1161844396, 3125318951, 1431517754, 545492359, 4268468663, 3499529547, 1437099964, 2702547544, 3433638243, 2581715763, 2787789398, 1060185593, 1593081372, 2418618748, 4260947970, 69676912, 2159744348, 86519011, 2512459080, 3838209314, 1220612927, 3339683548, 133810670, 1090789135, 1078426020, 1569222167, 845107691, 3583754449, 4072456591, 1091646820, 628848692, 1613405280, 3757631651, 526609435, 236106946, 48312990, 2942717905, 3402727701, 1797494240, 859738849, 992217954, 4005476642, 2243076622, 3870952857, 3732016268, 765654824, 3490871365, 2511836413, 1685915746, 3888969200, 1414112111, 2273134842, 3281911079, 4080962846, 172450625, 2569994100, 980381355, 4109958455, 2819808352, 2716589560, 2568741196, 3681446669, 3329971472, 1835478071, 660984891, 3704678404, 4045999559, 3422617507, 3040415634, 1762651403, 1719377915, 3470491036, 2693910283, 3642056355, 3138596744, 1364962596, 2073328063, 1983633131, 926494387, 3423689081, 2150032023, 4096667949, 1749200295, 3328846651, 309677260, 2016342300, 1779581495, 3079819751, 111262694, 1274766160, 443224088, 298511866, 1025883608, 3806446537, 1145181785, 168956806, 3641502830, 3584813610, 1689216846, 3666258015, 3200248200, 1692713982, 2646376535, 4042768518, 1618508792, 1610833997, 3523052358, 4130873264, 2001055236, 3610705100, 2202168115, 4028541809, 2961195399, 1006657119, 2006996926, 3186142756, 1430667929, 3210227297, 1314452623, 4074634658, 4101304120, 2273951170, 1399257539, 3367210612, 3027628629, 1190975929, 2062231137, 2333990788, 2221543033, 2438960610, 1181637006, 548689776, 2362791313, 3372408396, 3104550113, 3145860560, 296247880, 1970579870, 3078560182, 3769228297, 1714227617, 3291629107, 3898220290, 166772364, 1251581989, 493813264, 448347421, 195405023, 2709975567, 677966185, 3703036547, 1463355134, 2715995803, 1338867538, 1343315457, 2802222074, 2684532164, 233230375, 2599980071, 2000651841, 3277868038, 1638401717, 4028070440, 3237316320, 6314154, 819756386, 300326615, 590932579, 1405279636, 3267499572, 3150704214, 2428286686, 3959192993, 3461946742, 1862657033, 1266418056, 963775037, 2089974820, 2263052895, 1917689273, 448879540, 3550394620, 3981727096, 150775221, 3627908307, 1303187396, 508620638, 2975983352, 2726630617, 1817252668, 1876281319, 1457606340, 908771278, 3720792119, 3617206836, 2455994898, 1729034894, 1080033504 ], [ 976866871, 3556439503, 2881648439, 1522871579, 1555064734, 1336096578, 3548522304, 2579274686, 3574697629, 3205460757, 3593280638, 3338716283, 3079412587, 564236357, 2993598910, 1781952180, 1464380207, 3163844217, 3332601554, 1699332808, 1393555694, 1183702653, 3581086237, 1288719814, 691649499, 2847557200, 2895455976, 3193889540, 2717570544, 1781354906, 1676643554, 2592534050, 3230253752, 1126444790, 2770207658, 2633158820, 2210423226, 2615765581, 2414155088, 3127139286, 673620729, 2805611233, 1269405062, 4015350505, 3341807571, 4149409754, 1057255273, 2012875353, 2162469141, 2276492801, 2601117357, 993977747, 3918593370, 2654263191, 753973209, 36408145, 2530585658, 25011837, 3520020182, 2088578344, 530523599, 2918365339, 1524020338, 1518925132, 3760827505, 3759777254, 1202760957, 3985898139, 3906192525, 674977740, 4174734889, 2031300136, 2019492241, 3983892565, 4153806404, 3822280332, 352677332, 2297720250, 60907813, 90501309, 3286998549, 1016092578, 2535922412, 2839152426, 457141659, 509813237, 4120667899, 652014361, 1966332200, 2975202805, 55981186, 2327461051, 676427537, 3255491064, 2882294119, 3433927263, 1307055953, 942726286, 933058658, 2468411793, 3933900994, 4215176142, 1361170020, 2001714738, 2830558078, 3274259782, 1222529897, 1679025792, 2729314320, 3714953764, 1770335741, 151462246, 3013232138, 1682292957, 1483529935, 471910574, 1539241949, 458788160, 3436315007, 1807016891, 3718408830, 978976581, 1043663428, 3165965781, 1927990952, 4200891579, 2372276910, 3208408903, 3533431907, 1412390302, 2931980059, 4132332400, 1947078029, 3881505623, 4168226417, 2941484381, 1077988104, 1320477388, 886195818, 18198404, 3786409e3, 2509781533, 112762804, 3463356488, 1866414978, 891333506, 18488651, 661792760, 1628790961, 3885187036, 3141171499, 876946877, 2693282273, 1372485963, 791857591, 2686433993, 3759982718, 3167212022, 3472953795, 2716379847, 445679433, 3561995674, 3504004811, 3574258232, 54117162, 3331405415, 2381918588, 3769707343, 4154350007, 1140177722, 4074052095, 668550556, 3214352940, 367459370, 261225585, 2610173221, 4209349473, 3468074219, 3265815641, 314222801, 3066103646, 3808782860, 282218597, 3406013506, 3773591054, 379116347, 1285071038, 846784868, 2669647154, 3771962079, 3550491691, 2305946142, 453669953, 1268987020, 3317592352, 3279303384, 3744833421, 2610507566, 3859509063, 266596637, 3847019092, 517658769, 3462560207, 3443424879, 370717030, 4247526661, 2224018117, 4143653529, 4112773975, 2788324899, 2477274417, 1456262402, 2901442914, 1517677493, 1846949527, 2295493580, 3734397586, 2176403920, 1280348187, 1908823572, 3871786941, 846861322, 1172426758, 3287448474, 3383383037, 1655181056, 3139813346, 901632758, 1897031941, 2986607138, 3066810236, 3447102507, 1393639104, 373351379, 950779232, 625454576, 3124240540, 4148612726, 2007998917, 544563296, 2244738638, 2330496472, 2058025392, 1291430526, 424198748, 50039436, 29584100, 3605783033, 2429876329, 2791104160, 1057563949, 3255363231, 3075367218, 3463963227, 1469046755, 985887462 ] ];
        var kl = k.length > 56 ? 56 : k.length;
        for (var i = 0, ki = 0; i < 18; i++) {
            var d = 0, di = 4;
            while (di--) d = d << 8 | k[ki++ % kl];
            this.p[i] ^= d;
        }
        var l = new jsbfsh.val(), r = new jsbfsh.val();
        for (var i = 0; i < 18; ) {
            jsbfsh.rounds(this, l, r, -1, 1);
            this.p[i++] = l.v;
            this.p[i++] = r.v;
        }
        for (var s = 0; s < 4; s++) {
            for (i = 0; i < 256; ) {
                jsbfsh.rounds(this, l, r, -1, 1);
                this.s[s][i++] = l.v;
                this.s[s][i++] = r.v;
            }
        }
    },
    fetch: function(d, i, l, r) {
        l.v = d[i] << 24;
        l.v |= d[i + 1] << 16;
        l.v |= d[i + 2] << 8;
        l.v |= d[i + 3];
        r.v = d[i + 4] << 24;
        r.v |= d[i + 5] << 16;
        r.v |= d[i + 6] << 8;
        r.v |= d[i + 7];
    },
    store: function(d, i, l, r) {
        d[i] = l.v >> 24 & 255;
        d[i + 1] = l.v >> 16 & 255;
        d[i + 2] = l.v >> 8 & 255;
        d[i + 3] = l.v & 255;
        d[i + 4] = r.v >> 24 & 255;
        d[i + 5] = r.v >> 16 & 255;
        d[i + 6] = r.v >> 8 & 255;
        d[i + 7] = r.v & 255;
    },
    encrypt: function(c, d, iv) {
        var s = -1, sa = 1;
        if (iv.length != 8) return false;
        var n = d.length & 7;
        while (n++ & 7) d.push(0);
        n = d.length;
        var l = new jsbfsh.val(), r = new jsbfsh.val();
        var tl = new jsbfsh.val(), tr = new jsbfsh.val();
        jsbfsh.fetch(iv, 0, tl, tr);
        for (var i = 0; i < n; i += 8) {
            jsbfsh.fetch(d, i, l, r);
            l.v ^= tl.v;
            r.v ^= tr.v;
            jsbfsh.rounds(c, l, r, s, sa);
            tl.v = l.v;
            tr.v = r.v;
            jsbfsh.store(d, i, l, r);
        }
        return n;
    },
    decrypt: function(c, d, iv) {
        var s = 18, sa = -1;
        if (iv.length != 8) return false;
        var n = d.length & 7;
        while (n++ & 7) d.push(0);
        n = d.length;
        var l = new jsbfsh.val(), r = new jsbfsh.val();
        var tl = new jsbfsh.val(), tr = new jsbfsh.val();
        var ol = new jsbfsh.val(), or = new jsbfsh.val();
        jsbfsh.fetch(iv, 0, ol, or);
        for (var i = 0; i < n; i += 8) {
            jsbfsh.fetch(d, i, l, r);
            tl.v = l.v;
            tr.v = r.v;
            jsbfsh.rounds(c, l, r, s, sa);
            l.v ^= ol.v;
            r.v ^= or.v;
            jsbfsh.store(d, i, l, r);
            ol.v = tl.v;
            or.v = tr.v;
        }
        return n;
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