/**
 * Represents single packet inside replay
 */

wot.replay.packet = function() { this.construct.apply(this, arguments); }
wot.replay.packet.prototype = {
	construct: function(data) {
		this.view = new DataView(data);
		//console.log(new Uint8Array(data));
		this.data = data;
		this.length = data.byteLength;
	
		this.type = this.view.getUint32(4, true);
		if (this.length > 8) {
			this.clock = this.view.getFloat32(8, true);
		}
		
		if (this.types[this.type])
			this.types[this.type].apply(this, [this.view]);
	}
}