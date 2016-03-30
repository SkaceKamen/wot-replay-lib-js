/**
 * Provides data for different packet types
 */
 
wot.replay.packet.prototype.decodeAngle = function(code, bits) {
	return Math.PI * 2 * code / (1 << bits) - Math.PI;
}

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
			if (this.health > 20000)
				this.health = 0;
		}
	},
	7: function(u) {
		this.playerId = u.getUint32(12, true);
		this.subType = u.getUint32(16,true);
		
		switch(this.subType) {
			case 2:
			case 3:	
				if (this.length >= 26) {
					this.ident = "turret_rotation";
					
					this.code = u.getInt16(24, true);
					this.turretRotation = this.decodeAngle(this.code >> 6 & 1023, 10);
					
					this.getGunRotation = function(min, max) {
						return min + ((this.code & 63) / ((1 << 6) - 1)) * (max - min);
					}
				}
				break;
			case 4:
				if (this.length >= 26) {
					this.ident = "vehicle_health";
					
					this.health = u.getUint16(24,true);
					if (this.health > 20000)
						this.health = 0;
				}
				break;
			case 4:
				break;
			case 6:
				break;
			/*case 7:
				break;*/
			case 9:
				this.ident = "vehicle_killed";
			
				//Killed
				break;
		}
	},
	8: function(u) {
		this.playerId = u.getUint32(12, true);
		this.subType = u.getUint32(16,true);
		
		switch(this.subType) {
			case 0:
				//shot fired
				this.ident = "shot_fired";
				break;
			case 1:
				this.ident = "vehicle_damaged";
				
				this.health = u.getInt16(24,true);
				if (this.health < 0)
					this.health = 0;
				this.source = u.getUint32(26,true);
				break;
			case 6:
				//Bounced
				this.ident = "shot_bounced";
				break;
			case 7:
				//Penetrated
				this.ident = "shot_penetrated";
				this.source = u.getUint32(24, true);
				break;
			case 40:
			case 41:
				try {
					this.roster = pickle.load(wot.replay.parser.prototype.decompress(u.buffer.slice(29)));
					this.ident = "roster";
				} catch(e) {

				}
				break;
			case 30:			
				try {
					this.roster = pickle.load(u.buffer.slice(29));
					this.ident = "roster";
				} catch(e) {
					
				}
				break;
		}
	},
	10: function(u) {
		this.ident = "vehicle_position_rotation";
		
		this.position = [];
		this.hullRotation = [];
		
		this.playerId = u.getUint32(12, true);
		this.position[0] = u.getFloat32(20,true);
		this.position[1] = u.getFloat32(24,true);
		this.position[2] = u.getFloat32(28,true);
		this.hullRotation[0] = u.getFloat32(44,true);
		this.hullRotation[1] = u.getFloat32(48,true);
		this.hullRotation[2] = u.getFloat32(52,true);
	},
	22: function(u) {
		this.ident = "game_state";
		this.gameState = u.getUint32(12,true);
	},
	26: function(u) {
		this.currentPosition = [];
		this.currentRadius = 0;
		
		this.targetPosition = [];
		this.targetRotation = [];
		this.targetRadius = 0;
		
		this.ident = "recticle_position";
		
		this.targetPosition[0] = u.getFloat32(12,true);
		this.targetPosition[1] = u.getFloat32(16,true);
		this.targetPosition[2] = u.getFloat32(20,true);
		this.targetRadius = u.getFloat32(24, true);
		
		this.currentPosition[0] = u.getFloat32(28,true);
		this.currentPosition[1] = u.getFloat32(32,true);
		this.currentPosition[2] = u.getFloat32(36,true);
		
		this.targetRotation[0] = u.getFloat32(40,true);
		this.targetRotation[1] = u.getFloat32(44,true);
		this.targetRotation[2] = u.getFloat32(48,true);
		
		this.currentRadius = u.getFloat32(52, true);
	},
	38: function(u) {
		this.position = [];
		this.rotation = [0,0,0];
		
		this.ident = "camera_position";
		
		this.rotation[0] = u.getFloat32(12,true);
		this.rotation[1] = u.getFloat32(16,true);
		this.rotation[2] = u.getFloat32(20,true);
		this.rotation[3] = u.getFloat32(24,true);
		
		this.position[0] = u.getFloat32(28,true);
		this.position[1] = u.getFloat32(32,true);
		this.position[2] = u.getFloat32(36,true);
		
		/*var text = "";		
		for(var i = 40; i <= 48; i += 4) {
			var str = u.getFloat32(i,true).toFixed(4);
			if (str.indexOf("-") == -1)
				str = "+" + str;
			text += str + " ";
		}
		
		this.text = text;*/
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
	35: function(u) {
		var c = u.getUint32(12, true);
		this.message = "";
		this.ident = "message";
		for(var i = 0; i < c; i++)
			this.message += String.fromCharCode(u.getUint8(16 + i));
		//console.log(this.clock, this.message);
	}
}