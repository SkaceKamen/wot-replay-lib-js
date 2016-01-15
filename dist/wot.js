wot = {};

wot.parser = function() {};

wot.parser.prototype = {
    DB_COUNT_OFFSET: 4,
    DB_DATA_OFFSET: 8,
    BF_BLOCKSIZE: 8,
    BF_KEY: "DE72BEA0DE04BEB1DEFEBEEFDEADBEEF",
    parse: function(array_buffer) {
        var view = new DataView(array_buffer), replay = new wot.replay();
        replay.setBlocks(this.readBlocks(view));
        replay.begin = JSON.parse(this.ab2str(replay.begin));
        if (replay.end) replay.end = JSON.parse(this.ab2str(replay.end));
        MAIN_REPLAY = replay;
        replay.raw_zip = this.decrypt(replay.raw);
        replay.raw_dec = this.decompress(replay.raw_zip);
        replay.raw = replay.raw_dec;
        replay.setPackets(this.readPackets(replay.raw));
        return replay;
    },
    ab2str: function(buf, length) {
        if (typeof length === "undefined") return String.fromCharCode.apply(null, new Uint8Array(buf));
        var str = String.fromCharCode.apply(null, new Uint8Array(buf));
        for (var i = str.length; i < length; i++) str += String.fromCharCode(0);
        return str;
    },
    str2ab: function(str) {
        var buff = new ArrayBuffer(str.length), view = new Uint8Array(buff), i = 0;
        for (i = 0; i < str.length; i += 1) {
            if (str.charCodeAt(i) > 255) throw new Error(i + " too big: " + str.charCodeAt(i) + "( " + str.length + ")");
            view[i] = str.charCodeAt(i);
        }
        return buff;
    },
    readPackets: function(data) {
        var reader = new wot.replay.packet.reader(data), packets = [];
        while (reader.hasNext()) packets.push(reader.next());
        return packets;
    },
    decrypt: function(data) {
        var key = [];
        for (var i = 0; i < this.BF_KEY.length; i += 2) {
            key.push(parseInt(this.BF_KEY.substr(i, 2), 16));
        }
        var bf = new jsbfsh.context(key), padding = this.BF_BLOCKSIZE - data.byteLength % this.BF_BLOCKSIZE, previous = new Uint8Array(this.BF_BLOCKSIZE), result = new ArrayBuffer(data.byteLength + padding), view = new Uint8Array(result);
        for (var i = 0; i < this.BF_BLOCKSIZE; i++) previous[i] = 0;
        for (var i = 0; i < data.byteLength; i += this.BF_BLOCKSIZE) {
            var block = new Uint8Array(data.slice(i, i + this.BF_BLOCKSIZE));
            if (block.length < this.BF_BLOCKSIZE) {
                var v = new Uint8Array(this.BF_BLOCKSIZE);
                for (var n = 0; n < this.BF_BLOCKSIZE; n++) v[n] = block[n];
                block = v;
            }
            jsbfsh.decrypt(bf, block, [ 0, 0, 0, 0, 0, 0, 0, 0 ]);
            for (var x = 0; x < this.BF_BLOCKSIZE; x++) {
                block[x] = previous[x] ^ block[x];
                previous[x] = block[x];
                view[i + x] = block[x];
            }
        }
        return result.slice(0, data.byteLength);
    },
    decompress: function(data) {
        var result = pako.inflate(new Uint8Array(data)), buff = new ArrayBuffer(result.length), view = new Uint8Array(buff);
        for (var i = 0; i < result.length; i++) view[i] = result[i];
        return buff;
    },
    readBlocks: function(view) {
        var blocks = [], count = view.getUint32(this.DB_COUNT_OFFSET, true), offset = this.DB_DATA_OFFSET;
        for (var i = 0; i < count; i++) {
            var size = view.getUint32(offset, true), block_offset = offset + 4;
            blocks.push(view.buffer.slice(block_offset, block_offset + size));
            offset = block_offset + size;
        }
        blocks.push(view.buffer.slice(offset + 8));
        return blocks;
    }
};

wot.player = function() {
    this.construct.apply(this, arguments);
};

wot.player.prototype = {
    replay: null,
    clock: 0,
    lastClock: 0,
    state: "stopped",
    onPacket: null,
    onPlayerPosition: null,
    onPlayerRotation: null,
    onPlayerHealth: null,
    onPlayerTurretRotation: null,
    onPlayerSpotted: null,
    onPlayerUnspotted: null,
    onPlayerDamaged: null,
    construct: function(replay) {
        this.onPacket = new wot.player.event();
        this.onPlayerPosition = new wot.player.event();
        this.onPlayerRotation = new wot.player.event();
        this.onPlayerHealth = new wot.player.event();
        this.onPlayerTurretRotation = new wot.player.event();
        this.onPlayerTurretYaw = new wot.player.event();
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
        while (this.clock < clock) {
            this.tick(1);
        }
    },
    tick: function(clock_incerase) {
        var packets = this.replay.getPackets(Math.floor(this.clock));
        for (var i = 0, l = packets.length; i < l; i++) {
            var packet = packets[i];
            if (packet.clock < this.lastClock) continue;
            if (packet.clock > this.clock) continue;
            this.onPacket.fire(this, packet);
            switch (packet.type) {
              case 5:
                this.onPlayerSpotted.fire(this, packet.playerId);
                this.onPlayerHealth.fire(this, packet.health);
                break;

              case 7:
                switch (packet.subType) {
                  case 2:
                    this.onPlayerTurretRotation.fire(this, packet.playerId, packet.turretRotation);
                    break;

                  case 3:
                    this.onPlayerHealth.fire(this, packet.playerId, packet.health);
                    break;

                  case 4:
                    this.onPlayerTurretYaw.fire(this, packet.playerId, packet.gunRotation);
                    break;
                }
                break;

              case 8:
                switch (packet.subType) {
                  case 1:
                    this.onPlayerDamaged.fire(this, packet.playerId, packet.source, packet.health);
                    this.onPlayerHealth.fire(this, packet.playerId, packet.health);
                    break;
                }
                break;

              case 10:
                this.onPlayerPosition.fire(this, packet.playerId, packet.position);
                this.onPlayerRotation.fire(this, packet.playerId, packet.hullRotation);
                break;

              case 25:
                break;
            }
        }
        this.lastClock = this.clock;
        this.clock += clock_incerase;
    }
};

wot.player.event = function() {
    this.construct.apply(this, arguments);
};

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
        Array.prototype.push.apply(args, arguments);
        args.shift();
        for (var i = 0; i < this.listeners.length; i++) {
            this.listeners[i].apply(scope, args);
        }
    }
};

wot.replay = function() {
    this.construct.apply(this, arguments);
};

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
        if (this.blocks.length > 2) this.end = this.blocks[1];
        this.raw = this.blocks[this.blocks.length - 1];
    },
    setPackets: function(packets) {
        this.packets = packets;
        this.frames = {};
        for (var i = 0, l = this.packets.length; i < l; i++) {
            var packet = this.packets[i];
            var clock = Math.floor(packet.clock);
            if (!this.frames[clock]) this.frames[clock] = [];
            this.frames[clock].push(packet);
            if (packet.clock > this.maxClock) this.maxClock = packet.clock;
            if (packet.type == 18) {
                this.battleStart = packet.clock;
            }
            if (packet.type == 0) {
                this.mainPlayerName = packet.playerName;
            }
            if (packet.type == 30) {
                this.mainPlayerId = packet.playerId;
            }
        }
    },
    getMainPlayerId: function() {
        if (this.mainPlayerId == null) {
            for (var id in this.begin.vehicles) {
                if (this.begin.vehicles[id].name == this.main) return id;
            }
        }
        return this.mainPlayerId;
    },
    getPackets: function(clock) {
        return this.frames[clock] ? this.frames[clock] : [];
    },
    getPacketsIn: function(from, to) {
        var found = [];
        for (var i = 0, l = this.packets.length; i < l; i++) {
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
        return [ (point[0] - box[0]) / (box[2] - box[0]) * target_width, (point[2] - box[1]) / (box[3] - box[1]) * target_height, point[1] ];
    },
    getPlayerPackets: function(player) {
        var result = [];
        for (var i = 0, l = this.packets.length; i < l; i++) {
            var packet = this.packets[i];
            if (packet.playerId && packet.playerId == player) {
                result.push(packet);
            }
        }
        return result;
    },
    getPacketsByType: function(type, subtype) {
        var result = [];
        for (var i = 0, l = this.packets.length; i < l; i++) {
            var packet = this.packets[i];
            if (packet.type == type && (typeof subtype === "undefined" || packet.subType == subtype)) {
                result.push(packet);
            }
        }
        return result;
    },
    getTypes: function(packets) {
        if (!packets) packets = this.packets;
        var result = {};
        for (var i = 0, l = packets.length; i < l; i++) {
            var packet = packets[i];
            if (!result[packet.type]) {
                result[packet.type] = {
                    count: 1,
                    packets: [ packet ],
                    sizes: [ packet.length ]
                };
            } else {
                var found = result[packet.type].sizes.indexOf(packet.length);
                if (found == -1) result[packet.type].sizes.push(packet.length);
                result[packet.type].count += 1;
                result[packet.type].packets.push(packet);
            }
        }
        return result;
    }
};

wot.replay.packet = function() {
    this.construct.apply(this, arguments);
};

wot.replay.packet.prototype = {
    construct: function(data) {
        this.view = new DataView(data);
        this.data = data;
        this.length = data.byteLength;
        this.type = this.view.getUint32(4, true);
        if (this.length > 8) {
            this.clock = this.view.getFloat32(8, true);
        }
        if (this.types[this.type]) this.types[this.type].apply(this, [ this.view ]);
    }
};

wot.replay.packet.reader = function(data) {
    this.data = data;
    this.view = new DataView(data);
};

wot.replay.packet.reader.prototype = {
    BASE_PACKET_SIZE: 12,
    position: 0,
    next: function() {
        var payload_size = this.view.getInt32(this.position, true), packet_size = payload_size + this.BASE_PACKET_SIZE;
        if (this.position + packet_size > this.data.byteLength) throw new Error("Packet outside bounds!");
        var packet = new wot.replay.packet(this.data.slice(this.position, this.position + packet_size));
        this.previous = this.position;
        this.position += packet_size;
        return packet;
    },
    hasNext: function() {
        return !(this.position >= this.data.byteLength);
    }
};

wot.replay.packet.prototype.types = {
    0: function(u) {
        this.playerAltID = u.getUint32(12, true);
        this.playerName = "";
        var length = Math.min(u.getUint32(19), this.length - 23);
        for (var i = 0; i < length; i++) {
            this.playerName += String.fromCharCode(u.getUint8(23 + i, true));
        }
    },
    3: function(u) {
        this.playerId = u.getUint32(12, true);
    },
    5: function(u) {
        this.playerId = u.getUint32(12, true);
        this.health = u.getUint16(63, true);
    },
    7: function(u) {
        this.playerId = u.getUint32(12, true);
        this.subType = u.getUint32(16, true);
        switch (this.subType) {
          case 2:
            this.turretRotation = u.getUint16(24, true);
            this.turretRotation = this.turretRotation / 65535 * (Math.PI * 2) - Math.PI;
            break;

          case 3:
            this.health = u.getUint16(24, true);
            break;

          case 4:
            this.gunRotation = u.getUint16(24, true);
            this.gunRotation = this.gunRotation / 65535 * (Math.PI * 2) - Math.PI;
            break;
        }
    },
    8: function(u) {
        this.playerId = u.getUint32(12, true);
        this.subType = u.getUint32(16, true);
        switch (this.subType) {
          case 1:
            this.health = u.getUint16(24, true);
            this.source = u.getUint32(26, true);
            break;
        }
    },
    10: function(u) {
        this.position = [];
        this.hullRotation = [];
        this.playerId = u.getUint32(12, true);
        this.position[0] = u.getFloat32(24, true);
        this.position[1] = u.getFloat32(28, true);
        this.position[2] = u.getFloat32(32, true);
        this.hullRotation[0] = u.getFloat32(48, true);
        this.hullRotation[1] = u.getFloat32(52, true);
        this.hullRotation[2] = u.getFloat32(56, true);
    },
    18: function(u) {
        this.gameState = u.getUint32(12, true);
    },
    24: function(u) {
        this.angle = u.getFloat32(12, true);
    },
    25: function(u) {
        this.angle = u.getFloat32(12, true);
    },
    27: function(u) {
        this.angle = u.getFloat32(12, true);
    },
    30: function(u) {
        this.playerId = u.getUint32(12, true);
    }
};
//# sourceMappingURL=../../dist/wot.js.map