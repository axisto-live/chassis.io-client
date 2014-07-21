// IE Array#indexOf support
if (!Array.prototype.indexOf) {
  Array.prototype.indexOf = function(obj, start) {
    for (var i = (start || 0), j = this.length; i < j; i++) {
       if (this[i] === obj) { return i; }
    }
    return -1;
  };
}

// Event Emitter code, taken from Dashku.com

var EE,
  __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

EE = (function() {

  function EE() {
    this.emit = __bind(this.emit, this);

    this.on = __bind(this.on, this);
    this.listeners = {};
  }

  EE.prototype.on = function(eventName, fnk) {
    if (this.listeners[eventName] != null) {
      return this.listeners[eventName].push(fnk);
    } else {
      return this.listeners[eventName] = [fnk];
    }
  };

  EE.prototype.emit = function(eventName, data) {
    var fnk, _i, _len, _ref, _results;
    if (this.listeners[eventName] != null) {
      _ref = this.listeners[eventName];
      _results = [];
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        fnk = _ref[_i];
        _results.push(fnk(data));
      }
      return _results;
    }
  };

  return EE;

})();


//

var reconnectSwitch     = false
  , reconnectionTimeout = 1000
  , ee = new EE();

var attemptReconnect = function(time){
  console.log("attempting reconnect");
  spawn();
  setTimeout(function(){
    if (chassis.socket.readyState !== "open") {
      if (reconnectionTimeout < 10000) reconnectionTimeout *= 1.5;
      console.log("failed, will try again in ms: ", reconnectionTimeout);
      attemptReconnect(reconnectionTimeout);
    } else {
      console.log("successfully reconnected");
      reconnectSwitch = false;
      reconnectionTimeout = 1000;
      chassis.set(chassis.setCache);
      for (var c=0;c < chassis.channelManager.channels.length;c++) {
        var channel = chassis.channelManager.channels[c];
        chassis.subscribe(channel);
      };
    }
  }, time);
};

var spawn = function(){
  var url = 'ws://'+document.location.host;
  var socket = new eio.Socket({
    flashPath: '/js/'
  });
  socket.on('open', function () {

    // server transmits a message
    socket.on('message', function (rocket) {
      var cargo = JSON.parse(rocket);
      if (cargo.channelName != undefined) {
        ee.emit('publish', cargo);
      } else if (cargo.rfcUid != undefined) {
        chassis.rfcCallbacks[cargo.rfcUid](cargo.res);
        delete chassis.rfcCallbacks[cargo.rfcUid];
      }
    });

    // server dies or internet connection dropped
    socket.on('close', function () {
      console.log('closed');
      reconnectSwitch = true;
      attemptReconnect(reconnectionTimeout);
    });
  });

  chassis.socket = socket;
}

chassis = {

  ee: ee,

  // The channel manager keeps a record
  // of what channels the current browser
  // session has subscribed to, so that
  // if the connection is severed, we
  // we re-establish subscriptions that
  // would otherwise be lost.
  //
  // TODO - move to a server-based resubscribe
  // model on dropped connections.
  setCache: {},
  rfcCallbacks: {},

  channelManager: {
    channels: [],

    addChannel: function(channel) {
      var self = this;
      if (self.channels.indexOf(channel) == -1 ) {
        self.channels.push(channel);
      }
    },

    removeChannel: function(channel) {
      var self = this;
      var index = self.channels.indexOf(channel);
      if (index != -1) {
        self.channels.splice(index, 1);
      }
    }
  },

  set: function(data, cb) {
    var rocket = JSON.stringify({action: 'set', data:data});
    this.setCache = data;
    this.socket.send(rocket);
    if (typeof cb === 'function') cb();
  },

  subscribe: function(channel, cb) {
    var rocket = JSON.stringify({action: 'subscribe', channel: channel});
    this.socket.send(rocket);
    this.channelManager.addChannel(channel);
    if (typeof cb === 'function') cb();
  },

  unsubscribe: function(channel, cb) {
    var rocket = JSON.stringify({action: 'unsubscribe', channel: channel});
    this.socket.send(rocket);
    this.channelManager.removeChannel(channel);
    if (typeof cb === 'function') cb();
  },

  publish: function(channel, data, cb) {
    var rocket = JSON.stringify({action: 'publish', channel: channel, data: data});
    this.socket.send(rocket);
    if (typeof cb === 'function') cb();
  },

  rfc: function(command, data, cb) {
    var rfcUid = Math.random().toString().split('.')[1];
    this.rfcCallbacks[rfcUid] = cb;
    var rocket = JSON.stringify({action:'rfc', command: command, data: data, rfcUid: rfcUid});
    this.socket.send(rocket);
  }

};

spawn();