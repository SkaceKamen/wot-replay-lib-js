/**
 * Provides data for different packet types
 */

wot.replay.packet.prototype.types = {
	0: function(u) {
		this.playerAltID = u.getUint32(12, true);
		this.playerName = "";

		var length = Math.min(u.getUint32(19), this.length - 23);
		for(var i = 0; i < length; i++) {
			this.playerName += String.fromCharCode(u.getUint8(23 + i, true));
		}
	},
	3: function(u) {
		//this.playerId = u.Unpack("<L", this.data, 12)[0];
		this.playerId = u.getUint32(12, true);
	},
	5: function(u) {
		this.playerId = u.getUint32(12, true);
		this.health = u.getUint16(63, true);
	},
	7: function(u) {
		this.playerId = u.getUint32(12, true);
		this.subType = u.getUint32(16,true);
		
		switch(this.subType) {
			case 2:
				this.turretRotation = u.getUint16(24,true);
				this.turretRotation = (this.turretRotation / 65535) * (Math.PI * 2) - Math.PI;
				break;
			case 3:
				this.health = u.getUint16(24,true);
				break;
			case 4:
				this.gunRotation = u.getUint16(24,true);
				this.gunRotation = (this.gunRotation / 65535) * (Math.PI * 2) - Math.PI;
				break;
		}
	},
	8: function(u) {
		this.playerId = u.getUint32(12, true);
		this.subType = u.getUint32(16,true);
		
		switch(this.subType) {
			case 1:
				this.health = u.getUint16(24,true);
				this.source = u.getUint32(26,true);
				break;
		}
	},
	10: function(u) {
		this.position = [];
		this.hullRotation = [];
		
		this.playerId = u.getUint32(12, true);
		this.position[0] = u.getFloat32(24,true);
		this.position[1] = u.getFloat32(28,true);
		this.position[2] = u.getFloat32(32,true);
		this.hullRotation[0] = u.getFloat32(48,true);
		this.hullRotation[1] = u.getFloat32(52,true);
		this.hullRotation[2] = u.getFloat32(56,true);
	},
	18: function(u) {
		this.gameState = u.getUint32(12,true);
	},
	24: function(u) {
		this.angle = u.getFloat32(12,true);
	},
	25: function(u) {
		this.angle = u.getFloat32(12,true);
	},
	27: function(u) {
		this.angle = u.getFloat32(12,true);
	},
	30: function(u) {
		this.playerId = u.getUint32(12,true);
	},
}