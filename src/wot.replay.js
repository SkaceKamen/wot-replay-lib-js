if (typeof(wot) === "undefined")
	wot = {};

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
	
	construct: function() {},
	
	setBlocks: function(blocks) {
		this.blocks = blocks;
		this.begin = this.blocks[0];
		if (this.blocks.length > 2)
			this.end = this.blocks[1];
		this.raw = this.blocks[this.blocks.length - 1];
	},
	
	getRoster: function() {
		for(var i = 0; i < this.packets.length; i++) {
			var packet = this.packets[i];
			
			if (packet.roster && packet.roster.length == 30 && packet.roster[0].length > 2) {
				var roster = {};
				for(var i in packet.roster)
					roster[packet.roster[i][0]] = packet.roster[i];
				return roster;
			}
		}
		
		return null;
	},
	
	setPackets: function(packets) {
		this.packets = packets;
		this.frames = {};

		for(var i = 0, l = this.packets.length; i < l; i++) {

			var packet = this.packets[i];
			var clock = Math.floor(packet.clock);
			
			if (!this.frames[clock])
				this.frames[clock] = [];
			
			this.frames[clock].push(packet);
			
			if (packet.clock > this.maxClock)
				this.maxClock = packet.clock;
			
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
			for(var id in this.begin.vehicles) {
				if (this.begin.vehicles[id].name == this.mainPlayerName)
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
	
	getPacketsByIdent: function(ident) {
		var result = [];
		for(var i = 0, l = this.packets.length; i < l; i++) {
			var packet = this.packets[i];
			if (packet.ident == ident) {
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
