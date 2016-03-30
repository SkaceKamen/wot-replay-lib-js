/**
 * This class manages loading replay from wotreplay file
 */

wot.replay.parser = function() {}
wot.replay.parser.prototype = {
	DB_COUNT_OFFSET: 4,
	DB_DATA_OFFSET: 8,
	BF_BLOCKSIZE: 8,
	BF_KEY: 'DE72BEA0DE04BEB1DEFEBEEFDEADBEEF',
	
	parse: function(array_buffer) {
		var view = new DataView(array_buffer),
			replay = new wot.replay();
		
		pickle.modules['_BWp'] = {
			'Array': function() {
				var a = [];
				for(var i = 0; i < arguments.length; i++)
					a.push(arguments[i]);
				return a;
			}
		}
		
		replay.setBlocks(this.readBlocks(view));
		replay.begin = JSON.parse(this.ab2str(replay.begin));
		if (replay.end)
			replay.end = JSON.parse(this.ab2str(replay.end));
			
		MAIN_REPLAY = replay;
		
		replay.raw_zip = this.decrypt(replay.raw);
		replay.raw_dec = this.decompress(replay.raw_zip);
		replay.raw = replay.raw_dec;
		
		replay.setPackets(this.readPackets(replay.raw));
		
		return replay;
	},
	
	ab2str: function(buf, length) {
		if (typeof(length) === "undefined")
			return String.fromCharCode.apply(null, new Uint8Array(buf));
		var str = String.fromCharCode.apply(null, new Uint8Array(buf));
		for(var i = str.length; i < length; i++)
			str += String.fromCharCode(0);
		return str;
	},
	
	str2ab: function(str) {
		var buff = new ArrayBuffer(str.length),
			view = new Uint8Array(buff),
			i = 0;
		for(i = 0; i < str.length; i += 1) {
			if (str.charCodeAt(i) > 255)
				throw new Error(i + " too big: " + str.charCodeAt(i) + "( " + str.length + ")");
			view[i] = str.charCodeAt(i);
		}
		
		return buff;
	},
	
	readPackets: function(data) {
		var reader = new wot.replay.packet.reader(data),
			packets = [];
		while(reader.hasNext())
			packets.push(reader.next());
		return packets;
	},
	
	decrypt: function(data) {
		var key = []
		
		for(var i = 0; i < this.BF_KEY.length; i += 2) {
			key.push(parseInt(this.BF_KEY.substr(i, 2), 16));
		}
		
		var bf = new jsbfsh.context(key),
			padding = this.BF_BLOCKSIZE - (data.byteLength % this.BF_BLOCKSIZE),
			previous = new Uint8Array(this.BF_BLOCKSIZE),
			result = new ArrayBuffer(data.byteLength + padding),
			view = new Uint8Array(result);
		
		for(var i = 0; i < this.BF_BLOCKSIZE; i++)
			previous[i] = 0;
		
		for(var i = 0; i < data.byteLength; i += this.BF_BLOCKSIZE) {
			var block = new Uint8Array(data.slice(i, i + this.BF_BLOCKSIZE));
			if (block.length < this.BF_BLOCKSIZE) {
				var v = new Uint8Array(this.BF_BLOCKSIZE);
				for(var n = 0; n < this.BF_BLOCKSIZE; n++)
					v[n] = block[n];
				block = v;
			}
			
			jsbfsh.decrypt(bf, block, [0, 0, 0, 0, 0, 0, 0, 0]);
			for(var x = 0; x < this.BF_BLOCKSIZE; x++) {
				block[x] = previous[x] ^ block[x];
				previous[x] = block[x];
				view[i + x] = block[x];
			}
		} 
		
		return result.slice(0, data.byteLength);
	},
	
	decompress: function(data) {
		var result = pako.inflate(new Uint8Array(data)),
			buff = new ArrayBuffer(result.length),
			view = new Uint8Array(buff);
		for(var i = 0; i < result.length; i++)
			view[i] = result[i];
		return buff;
	},
	
	readBlocks: function(view) {
		var blocks = [],
			count = view.getUint32(this.DB_COUNT_OFFSET, true),
			offset = this.DB_DATA_OFFSET;
		
		for(var i = 0; i < count; i++) {
			var size = view.getUint32(offset, true),
				block_offset = offset + 4;

			blocks.push(view.buffer.slice(block_offset, block_offset + size));
			offset = block_offset + size;
		}
		
		blocks.push(view.buffer.slice(offset + 8));
		
		return blocks;
	},
}