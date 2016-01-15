/**
 * This class allows to easilly process packets and fire simple events to display replay progress
 */

wot.player = function() { this.construct.apply(this, arguments); }
wot.player.prototype = {
	replay: null,
	clock: 0,
	lastClock: 0,
	state: "stopped",
	
	//PACKET
	onPacket: null,
	
	//PLAYER_ID [X,Y,Z]
	onPlayerPosition: null,
	//PLAYER_ID, [X,Y,Z]
	onPlayerRotation: null,
	//PLAYER_ID, HEALTH
	onPlayerHealth: null,
	//PLAYER_ID, TURRET ROTATION
	onPlayerTurretRotation: null,
	
	//PLAYER_ID
	onPlayerSpotted: null,
	//PLAYER_ID
	onPlayerUnspotted: null,
	//PLAYER_ID, DAMAGER, RESULT_HEALTH
	onPlayerDamaged: null,
	
	construct: function(replay) {
		this.onPacket = new wot.player.event();
		this.onPlayerPosition = new wot.player.event();
		this.onPlayerRotation = new wot.player.event();
		this.onPlayerHealth = new wot.player.event();
		this.onPlayerTurretRotation = new wot.player.event();
		this.onPlayerGunRotation = new wot.player.event();
		this.onPlayerSpotted = new wot.player.event();
		this.onPlayerUnspotted = new wot.player.event();
		this.onPlayerDamaged = new wot.player.event();
		
		this.setReplay(replay);
	},
	
	setReplay: function(replay) {
		this.replay = replay;
	},
		
	seek: function(clock) {
		this.clock = 0;
		
		//@TODO: Ignore position / damage / rotation ?
		while(this.clock < clock) {
			this.tick(1);
		}
	},
	
	tick: function(clock_incerase) {
		var packets = this.replay.getPackets(Math.floor(this.clock));

		for(var i = 0, l = packets.length; i < l; i++) {
			var packet = packets[i];
			
			if (packet.clock < this.lastClock)
				continue;
			
			if (packet.clock > this.clock)
				continue;
			
			this.onPacket.fire(this, packet);
				
			switch(packet.type) {
				case 5:
					this.onPlayerSpotted.fire(this, packet.playerId);
					this.onPlayerHealth.fire(this, packet.health);
					break;
				case 7:
					switch(packet.subType) {
						case 2:
							this.onPlayerTurretRotation.fire(this, packet.playerId, packet.turretRotation);
							break;
						case 3:
							this.onPlayerHealth.fire(this, packet.playerId, packet.health);
							break;
						/*case 4:
							this.onPlayerGunRotation.fire(this, packet.playerId, packet.gunRotation);
							break;*/
					}
					break;
				case 8:
					switch(packet.subType) {
						case 1:
							this.onPlayerDamaged.fire(this, packet.playerId, packet.source, packet.health);
							this.onPlayerHealth.fire(this, packet.playerId, packet.health); //@TODO: Unecessary?
							break;
					}
					break;
				case 10:
					this.onPlayerPosition.fire(this, packet.playerId, packet.position);
					this.onPlayerRotation.fire(this, packet.playerId, packet.hullRotation);
					break;
				case 25:
					//this.onPlayerGunRotation.fire(this, packet.playerId, packet.angle);
					break;
			}
		}
		
		this.lastClock = this.clock;
		this.clock += clock_incerase;
	}
}