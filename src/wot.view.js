wot.view = function(buff) {
	this.view = new DataView(buff);
	this.buffer = buff;
	this.byteLength = this.view.byteLength;
	this.position = 0;
}
wot.view.prototype = {
	tell: function() {
		return this.position;
	},
	seek: function(position, type) {
		switch(type) {
			default:
				this.position = position;
				return;
			case 1:
				this.position += position;
				return;
			case 2:
				this.position = this.byteLength + position;
				return;
		}
	},
	readstring: function() {
		var str = this.readline(String.fromCharCode(0));
		if (str.charCodeAt(str.length - 1) == 0)
			str = str.substr(0, str.length - 1);
		return str;
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
	getFloats: function(n, big) {
		var results = [];
		for(var i = 0; i < n; i++) {
			results.push(this.getFloat32(big));
		}
		return results;
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