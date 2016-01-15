/**
 * Helper for player events
 */

wot.player.event = function() { this.construct.apply(this, arguments); }
wot.player.event.prototype = {
	listeners: null,
	construct: function() {
		this.listeners = [];
	},
	attach: function(handler) {
		this.listeners.push(handler);
	},
	remove: function(handler) {
		var index = this.listeners.indexOf(handler);
		if (index != -1) {
			this.listeners.splice(index, 1);
		}
	},
	fire: function(scope) {
		var args = [];
		Array.prototype.push.apply( args, arguments );

		args.shift();
		for(var i = 0; i < this.listeners.length; i++) {
			this.listeners[i].apply(scope, args);
		}
	}
}