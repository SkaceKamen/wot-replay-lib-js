/**
 * Represents replay.
 */

wot.replay = function() { this.construct.apply(this, arguments); }
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
	
	construct: function() {
	},
	
	setBlocks: function(blocks) {
		this.blocks = blocks;
		this.begin = this.blocks[0];
		if (this.blocks.length > 2)
			this.end = this.blocks[1];
		this.raw = this.blocks[this.blocks.length - 1];
	},
	
	setPackets: function(packets) {
		this.packets = packets;
		this.frames = {};

		for(var i = 0, l = this.packets.length; i < l; i++) {
			/*var start = new Date();
			var packet = new wot.replay.packet(this.data.packets[i]);
			var diff = (new Date()).getTime() - start;
			console.log("Took", diff);*/
			var packet = this.packets[i];
			var clock = Math.floor(packet.clock);
			
			if (!this.frames[clock])
				this.frames[clock] = [];
			
			this.frames[clock].push(packet);
			
			if (packet.clock > this.maxClock)
				this.maxClock = packet.clock;
			
			if (packet.type == 18) {
				this.battleStart = packet.clock;
			}
			
			if (packet.type == 0) {
				//var wrapped = new wot.replay.packet(packet);
				this.mainPlayerName = packet.playerName;
			}
			
			if (packet.type == 30) {
				//var wrapped = new wot.replay.packet(packet);
				this.mainPlayerId = packet.playerId;
			}
		}
	},
	
	getMainPlayerId: function() {
		if (this.mainPlayerId == null) {
			for(var id in this.begin.vehicles) {
				if (this.begin.vehicles[id].name == this.main)
					return id;
			}
		}
		return this.mainPlayerId;
	},
	
	getPackets: function(clock) {
		return this.frames[clock] ? this.frames[clock] : [];
	},
	
	getPacketsIn: function(from, to) {
		var found = [];
		for(var i = 0, l = this.packets.length; i < l; i++) {
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
		return [
			((point[0] - box[0]) / (box[2] - box[0])) * target_width,
			((point[2] - box[1]) / (box[3] - box[1])) * target_height,
			point[1]
		];
	},
	
	getPlayerPackets: function(player) {
		var result = [];
		for(var i = 0, l = this.packets.length; i < l; i++) {
			var packet = this.packets[i];
			if (packet.playerId && packet.playerId == player) {
				result.push(packet);
			}
		}
		return result;
	},
	
	getPacketsByType: function(type, subtype) {
		var result = [];
		for(var i = 0, l = this.packets.length; i < l; i++) {
			var packet = this.packets[i];
			if (packet.type == type && (typeof(subtype) === "undefined" || packet.subType == subtype)) {
				result.push(packet);
			}
		}
		return result;
	},
	
	getTypes: function(packets) {
		if (!packets)
			packets = this.packets;
	
		var result = {};
		for(var i = 0, l = packets.length; i < l; i++) {
			var packet = packets[i];
			if (!result[packet.type]) {
				result[packet.type] = {
					'count': 1,
					'packets': [packet],
					'sizes': [ packet.length ]
				};
			} else {
				var found = result[packet.type].sizes.indexOf(packet.length);
				if (found == -1)
					result[packet.type].sizes.push(packet.length);
			
				result[packet.type].count += 1;
				result[packet.type].packets.push(packet);
			}
		}
		return result;
	},
}
