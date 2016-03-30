/**
 * This class allows to easilly process packets and fire simple events to display replay progress
 */


wot.player = function() { this.construct.apply(this, arguments); }
wot.player.prototype = {
	replay: null,
	clock: 0,
	lastClock: -1,
	state: "stopped",
	
	//PACKET
	onPacket: null,
	
	//PLAYER_ID, CURRENT[X,Y,Z], NEXT[X,Y,Z], NEXT_DIFF
	onVehiclePosition: null,
	//PLAYER_ID, CURRENT[X,Y,Z], NEXT[X,Y,Z], NEXT_DIFF
	onVehicleRotation: null,
	//PLAYER_ID, HEALTH
	onVehicleHealth: null,
	//PLAYER_ID, TURRET ROTATION
	onVehicleTurretRotation: null,
	
	//PLAYER_ID
	onVehicleSpotted: null,
	//PLAYER_ID
	onVehicleUnspotted: null,
	//PLAYER_ID, DAMAGER, RESULT_HEALTH
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
		
		//@TODO: Ignore position / damage / rotation ?
		while(this.clock < clock) {
			this.tick(1);
		}
	},
	
	tick: function(clock_incerase) {
		var packets = [],
			vehicleUpdates = {},
			cameraUpdate = [],
			crossUpdate = [];
		
		for(var i = Math.floor(this.lastClock); i <= Math.floor(this.clock); i++) { 
			packets.push.apply(packets, this.replay.getPackets(i));
		}
		
		for(var i = 0, l = packets.length; i < l; i++) {
			var packet = packets[i];
				
			if (packet.clock <= this.lastClock)
				continue;
			
			if (packet.clock > this.clock)
				continue;
			
			this.onPacket.fire(this, packet);
				
			switch(packet.ident) {
				
				case "vehicle_unspotted":
					this.onVehicleUnspotted.fire(this, packet.playerId);
					break;
					
				case "vehicle_spotted":
					this.onVehicleSpotted.fire(this, packet.playerId);
					this.onVehicleHealth.fire(this, packet.health);
					break;
				
				case "turret_rotation":
					var next = this.nextPacket(packet.clock, packet.type, { subType: packet.subType, playerId: packet.playerId });
						
					this.onVehicleTurretRotation.fire(this,
						packet.playerId,
						packet.turretRotation,
						next ? next.turretRotation : packet.turretRotation,
						next ? next.clock - packet.clock : 0
					);

					this.onVehicleGunRotation.fire(this,
						packet.playerId,
						packet,
						next ? next : packet,
						next ? next.clock - packet.clock : 0
					);
					break;
					
				case "vehicle_health":
					this.onVehicleHealth.fire(this, packet.playerId, packet.health);
					break;
					
				case "vehicle_killed":
					this.onVehicleKilled.fire(this, packet.playerId);
					break;
					
				case "vehicle_damaged":
					this.onVehicleDamaged.fire(this, packet.playerId, packet.source, packet.health);
					this.onVehicleHealth.fire(this, packet.playerId, packet.health); //@TODO: Unecessary?
					if (packet.health <= 0)
						this.onVehicleKilled.fire(this, packet.playerId, packet.source);
					break;
				
				case "roster":
					if (packet.roster) {
						for(var i = 0; i < packet.roster.length; i++) {
							this.onVehicleRoster.fire(this, packet.roster[i][0], packet.roster[i]);
						}
					}
					break;
				
				case "vehicle_position_rotation":
					//Find next position packet
					var next = this.nextPacket(packet.clock, packet.type, { playerId: packet.playerId });
					
					if (vehicleUpdates[packet.playerId]) {
						vehicleUpdates[packet.playerId][1] = next ? next : packet;
					} else {
						vehicleUpdates[packet.playerId] = [
							packet,
							next ? next : packet
						];
					}
					
					break;
					
				case "recticle_position":
					var next = this.nextPacket(packet.clock, packet.type);
					if (!next)
						next = packet;
				
					if (crossUpdate.length > 0) {
						if (next.clock > crossUpdate[1].clock)
							crossUpdate[1] = next;
					} else {
						crossUpdate = [packet, next];
					}
					
					break;
					
				case "camera_position":
					var next = this.nextPacket(packet.clock, packet.type);
					if (!next)
						next = packet;
	
					if (cameraUpdate.length > 0) {
						if (next.clock > cameraUpdate[1].clock)
							cameraUpdate[1] = next;
					} else {
						cameraUpdate = [packet, next];
					}

					break;
				
				case "message":
					this.onMessage.fire(this, packet.message);
					break;
			}
		}
		
		if (crossUpdate.length > 0) {
			var packet = crossUpdate[0],
				next = crossUpdate[1];
			this.onCrossPosition.fire(this, packet, next, packet.clock, next.clock - packet.clock);
		}
		
		if (cameraUpdate.length > 0) {
			var packet = cameraUpdate[0],
				next = cameraUpdate[1];

			this.onCameraPosition.fire(this,
				packet.position, packet.rotation,
				next.position, next.rotation,
				packet.clock, next.clock - packet.clock
			);
		}
		
		for(var i in vehicleUpdates) {
			var packet = vehicleUpdates[i][0],
				next = vehicleUpdates[i][1];
			
			this.onVehiclePosition.fire(this,
				i,
				packet.position,
				next.position,
				packet.clock,
				next.clock - packet.clock
			);
			
			this.onVehicleRotation.fire(this,
				i,
				packet.hullRotation,
				next.hullRotation,
				packet.clock,
				next.clock - packet.clock
			);
		}
		
		this.lastClock = this.clock;
		this.clock += clock_incerase;
	},
	
	nextPacket: function(clock, type, params) {
		var from = clock;
		while(clock < this.replay.maxClock) {
			var packets = this.replay.getPackets(Math.floor(clock));

			for(var i = 0, l = packets.length; i < l; i++) {
				if (packets[i].clock <= from || packets[i].type != type)
					continue;
				var match = true;
				for(var p in params) {
					if (packets[i][p] != params[p]) {
						match = false;
						break;
					}
				}
				if (match)
					return packets[i];
			}
			
			clock += 1;
		}

		return null;
	},
}