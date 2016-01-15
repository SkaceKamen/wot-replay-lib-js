/**
 * This class manages reading packets from raw replay data
 */

wot.replay.packet.reader = function(data) {
	this.data = data;
	this.view = new DataView(data);
}

wot.replay.packet.reader.prototype = {
	BASE_PACKET_SIZE: 12,
	position: 0,
	
	next: function() {
		var payload_size = this.view.getInt32(this.position, true),
			packet_size = payload_size + this.BASE_PACKET_SIZE;
		
		if (this.position + packet_size > this.data.byteLength)
			throw new Error("Packet outside bounds!");
	
		var packet = new wot.replay.packet(this.data.slice(this.position, this.position + packet_size));
		
		this.previous = this.position;
		this.position += packet_size;
		
		return packet;
	},
	
	hasNext: function() {
		return !(this.position >= this.data.byteLength);
	}
}