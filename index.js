var request = require("requestretry");
var http = require("http");
var url = require("url");
var Service, Characteristic;
var ReqPool = [{
  maxSockets: 5
}];


module.exports = function(homebridge) {
  Service = homebridge.hap.Service;
  Characteristic = homebridge.hap.Characteristic;

  homebridge.registerAccessory("homebridge-http-JPHSB", "http-JPHSB", Http_jphsb);
}

function Http_jphsb(log, config) {
  this.log = log;

  this.name = config["name"];

  // general section
  this.service = config["service"] || "Switch";
  this.timeout = config["timeout"] || 2500;
  this.poolnumber = config["poolnumber"] || 0;
  this.maxAttempts = config["maxAttempts"] || 3;
  this.retryDelay = config["retryDelay"] || 100;
  this.status_url = config["status_url"];
  // light section
  this.on_url = config["on_url"];
  this.off_url = config["off_url"];
  this.brightness = config["brightness"] || "no";
  this.setbrightness_url = config["setbrightness_url"];
  this.hue = config["hue"] || "no";
  this.sethue_url = config["sethue_url"];
  this.saturation = config["saturation"] || "no";
  this.setsaturation_url = config["setsaturation_url"];
  // curtains sectopn
  this.move_url = config["move_url"];
  this.port = config["port"] || 5554;
  // thermostat section
  this.maxTemp = config.maxTemp || 30;
  this.minTemp = config.minTemp || 15;
  this.heatingstate_url = config["heatingstate_url"];
  this.temp_url = config["temp_url"];
  // leak detector section
  //this.port = config.port || 5555;
  // contact sensor section
  this.interval = config["interval"] || 1000 * 60 * 60;
  this.pingaddress = config["pingaddress"];

  var that = this;

  switch (this.service) {
    case "Switch":
      this.log('creating Switch');
      this.JPService = new Service.Switch(this.name);
      this.JPService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getPowerState.bind(this))
        .on('set', this.setPowerState.bind(this));
      break;
    case "Light":
      this.log('creating Lightbulb');
      this.JPService = new Service.Lightbulb(this.name);
      this.JPService
        .getCharacteristic(Characteristic.On)
        .on('get', this.getPowerState.bind(this))
        .on('set', this.setPowerState.bind(this));
      if (this.brightness == "yes") {
        this.log('... adding Brightness');
        this.JPService
          .addCharacteristic(Characteristic.Brightness)
          .on('set', this.setBrightness.bind(this));
      }
      if (this.hue == "yes") {
        this.log('... adding hue');
        this.JPService
          .addCharacteristic(Characteristic.Hue)
          .on('set', this.setHue.bind(this));
      }
      if (this.saturation == "yes") {
        this.log('... adding saturation');
        this.JPService
          .addCharacteristic(Characteristic.Saturation)
          .on('set', this.setSaturation.bind(this));
      }
      break;
    case "Blinds":

      this.log('creating Blinds');

      // register the service and provide the functions
      this.JPService = new Service.WindowCovering(this.name);

      // the current position (0-100%)
      // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L493
      this.JPService
        .getCharacteristic(Characteristic.CurrentPosition)
        .on('get', this.getCurrentPosition.bind(this));

      // the position state
      // 0 = DECREASING; 1 = INCREASING; 2 = STOPPED;
      // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L1138
      this.JPService
        .getCharacteristic(Characteristic.PositionState)

      // the target position (0-100%)
      // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L1564
      this.JPService
        .getCharacteristic(Characteristic.TargetPosition)
        .on('set', this.setTargetPosition.bind(this));

      this.server = http.createServer(function(request, response) {
        var urlObj = url.parse(request.url, true);
        if (urlObj['query']['pos'] != undefined) {
          //        if (request.url == "/done") {
          pos = urlObj['query']['pos'];
          that.JPService
            .setCharacteristic(Characteristic.CurrentPosition, parseInt(pos));
          that.JPService
            .setCharacteristic(Characteristic.PositionState, 2);
          that.log("blinds stopped at %d", parseInt(pos));
        } else {
          that.log("got blinds server access but pos not defined");
        }

        response.end('Successfully requested: ' + request.url);
      });
      this.server.listen(this.port, function() {
        that.log("listening on: http://<ipaddress>:%s", that.port);
      });
      break;
    case "Themostat":
      this.log('creating Thermostat');

      //Characteristic.TemperatureDisplayUnits.CELSIUS = 0;
      //Characteristic.TemperatureDisplayUnits.FAHRENHEIT = 1;
      this.temperatureDisplayUnits = Characteristic.TemperatureDisplayUnits.CELSIUS;
      this.currentTemperature = 19;
      // The value property of CurrentHeatingCoolingState must be one of the following:
      //Characteristic.CurrentHeatingCoolingState.OFF = 0;
      //Characteristic.CurrentHeatingCoolingState.HEAT = 1;
      //Characteristic.CurrentHeatingCoolingState.COOL = 2;
      this.heatingCoolingState = Characteristic.CurrentHeatingCoolingState.AUTO;
      this.targetTemperature = 21;
      // The value property of TargetHeatingCoolingState must be one of the following:
      //Characteristic.TargetHeatingCoolingState.OFF = 0;
      //Characteristic.TargetHeatingCoolingState.HEAT = 1;
      //Characteristic.TargetHeatingCoolingState.COOL = 2;
      //Characteristic.TargetHeatingCoolingState.AUTO = 3;
      this.targetHeatingCoolingState = Characteristic.TargetHeatingCoolingState.AUTO;

      this.JPService = new Service.Thermostat(this.name);
      // Required Characteristics
      this.JPService
        .getCharacteristic(Characteristic.CurrentHeatingCoolingState)
        .on('get', this.getCurrentHeatingCoolingState.bind(this));

      this.JPService
        .getCharacteristic(Characteristic.TargetHeatingCoolingState)
        .on('get', this.getTargetHeatingCoolingState.bind(this))
        .on('set', this.setTargetHeatingCoolingState.bind(this));

      this.JPService
        .getCharacteristic(Characteristic.CurrentTemperature)
        .on('get', this.getCurrentTemperature.bind(this));

      this.JPService
        .getCharacteristic(Characteristic.TargetTemperature)
        .on('get', this.getTargetTemperature.bind(this))
        .on('set', this.setTargetTemperature.bind(this));

      this.JPService
        .getCharacteristic(Characteristic.TemperatureDisplayUnits)
        .on('get', this.getTemperatureDisplayUnits.bind(this))
        .on('set', this.setTemperatureDisplayUnits.bind(this));

      this.JPService.getCharacteristic(Characteristic.CurrentTemperature)
        .setProps({
          minValue: this.minTemp,
          maxValue: this.maxTemp,
          minStep: 0.1
        });
      this.JPService.getCharacteristic(Characteristic.TargetTemperature)
        .setProps({
          minValue: this.minTemp,
          maxValue: this.maxTemp,
          minStep: 0.1
        });
      break;
    case "Leak":
      this.log('creating leak sensor');
      this.leakDetected = 0;
      this.JPService = new Service.LeakSensor(this.name);
      this.JPService
        .getCharacteristic(Characteristic.LeakDetected)
        .on('get', this.getLeakState.bind(this));

      this.server = http.createServer(function(request, response) {
        if (request.url == "/true")
          that.leakDetected = 1;
        else if (request.url == "/false")
          that.leakDetected = 0;
        that.log("Leak sensor set to %d", that.leakDetected);
        that.JPService.setCharacteristic(Characteristic.LeakDetected, that.leakDetected);
        response.end('Successfully requested: ' + request.url);
      });
      this.server.listen(this.port, function() {
        that.log("listening on: http://<ipaddress>:%s", that.port);
      });
      break;
    case "Contact":
      this.log('creating contact sensor');
      this.ContactDetected = 1;
      this.ContactDetected_d = 1;
      this.JPService = new Service.ContactSensor(this.name);
      this.JPService
        .getCharacteristic(Characteristic.ContactSensorState)
        .on('get', this.getContactState.bind(this));

      setInterval(function checkslaves() {
        if (that.ContactDetected == 0 && that.ContactDetected_d == 1) {
          that.ContactDetected = 1;
          that.JPService.setCharacteristic(Characteristic.ContactSensorState, !that.ContactDetected);
        }
        that.ContactDetected_d = 1;
        for (var i = 0; i < that.pingaddress.length; i++) {
          //that.log('polling %s', that.pingaddress[i]);
          request.get({
            url: that.pingaddress[i]
          }, function(err, response, body) {
            if (!err && response.statusCode == 200) {
              //that.log('%s : contact', this.uri.href);
              that.log('contact');
            } else {
              //that.log('%s : no contact. Setting alarm', this.uri.href);
              that.log('no contact. Setting alarm');
              that.ContactDetected = 0;
              that.ContactDetected_d = 0;
              that.JPService.setCharacteristic(Characteristic.ContactSensorState, !that.ContactDetected);
            }
          });
        }
        return checkslaves;
      }(), this.interval);
      break;
  }

  if (this.poolnumber > ReqPool.length - 1) {
    ReqPool[this.poolnumber] = {
      maxSockets: 5
    };
    this.log("created socketpool %d for %s", this.poolnumber, this.name);
  } else {
    this.log("using socketpool %d for %s", this.poolnumber, this.name);
  }
}

Http_jphsb.prototype.getPowerState = function(callback) {
  this.log("Getting power state...");

  request.get({
    url: this.status_url,
    pool: ReqPool[this.poolnumber],
    maxAttempts: this.maxAttempts,
    retryDelay: this.retryDelay,
    timeout: this.timeout
  }, function(err, response, body) {
    if (!err && response.statusCode == 200) {

      try {
        var info = JSON.parse(body);
        if (this.hue == "yes") {
          this.JPService
            .getCharacteristic(Characteristic.Hue).updateValue(parseInt(info.hue));
          this.log('hue is currently %s', parseInt(info.hue));
        }
        if (this.saturation == "yes") {
          this.JPService
            .getCharacteristic(Characteristic.Saturation).updateValue(parseInt(info.sat));
          this.log('saturation is currently %s', parseInt(info.sat));
        }
        if (this.brightness == "yes") {
          this.JPService
            .getCharacteristic(Characteristic.Brightness).updateValue(parseInt(info.bri));
          this.log('brightness is currently %s', parseInt(info.bri));
        }
        this.log('power is currently %s', parseInt(info.pow) ? 'ON' : 'OFF');
        callback(null, parseInt(info.pow)); // success
      } catch (e) {
        this.log('error in parsing response');
        callback(null, 0); // assume power off
      }
    } else {
      this.log("Error getting power state: %s %s", this.status_url, err);
      callback(err);
    }
  }.bind(this));
}

Http_jphsb.prototype.setPowerState = function(powerOn, callback) {

  var url;
  if (powerOn) {
    url = this.on_url;
    this.log("Setting power state to on");
  } else {
    url = this.off_url;
    this.log("Setting power state to off");
  }

  request.get({
    url: url,
    pool: ReqPool[this.poolnumber],
    maxAttempts: this.maxAttempts,
    retryDelay: this.retryDelay,
    timeout: this.timeout
  }, function(err, response, body) {
    if (!err && response.statusCode == 200) {
      this.log("power change complete.");
      callback(null); // success
    } else {
      this.log("Error setting power state. Response: %s %s", url, err);
      callback(err || new Error("Error setting power."));
    }
  }.bind(this));
}

Http_jphsb.prototype.setHue = function(level, callback) {
  var url = this.sethue_url.replace('%h', level);

  request.get({
    url: url,
    pool: ReqPool[this.poolnumber],
    maxAttempts: this.maxAttempts,
    retryDelay: this.retryDelay,
    timeout: this.timeout
  }, function(err, response, body) {
    if (!err && response.statusCode == 200) {
      this.log("hue change to %s complete.", level);
      callback(null); // success
    } else {
      this.log("Error setting hue. Response: %s %s", url, err);
      callback(err || new Error("Error setting hue."));
    }
  }.bind(this));
}

Http_jphsb.prototype.setBrightness = function(level, callback) {
  var url = this.setbrightness_url.replace('%b', level);

  request.get({
    url: url,
    pool: ReqPool[this.poolnumber],
    maxAttempts: this.maxAttempts,
    retryDelay: this.retryDelay,
    timeout: this.timeout
  }, function(err, response, body) {
    if (!err && response.statusCode == 200) {
      this.log("brightness change to %s complete.", level);
      callback(null); // success
    } else {
      this.log("Error setting brightness. Response: %s %s", url, err);
      callback(err || new Error("Error setting brightness."));
    }
  }.bind(this));
}

Http_jphsb.prototype.setSaturation = function(level, callback) {
  var url = this.setsaturation_url.replace('%s', level);

  request.get({
    url: url,
    pool: ReqPool[this.poolnumber],
    maxAttempts: this.maxAttempts,
    retryDelay: this.retryDelay,
    timeout: this.timeout
  }, function(err, response, body) {
    if (!err && response.statusCode == 200) {
      this.log("Saturation change to %s complete.", level);
      callback(null); // success
    } else {
      this.log("Error setting Saturation. Response: %s %s", url, err);
      callback(err || new Error("Error setting Saturation."));
    }
  }.bind(this));
}

/////////////////////////////////////////////////////////////////////
// blinds
/////////////////////////////////////////////////////////////////////

Http_jphsb.prototype.getCurrentPosition = function(callback) {
  this.log("Getting current position...");
  request.get({
    url: this.status_url,
    pool: ReqPool[this.poolnumber],
    maxAttempts: this.maxAttempts,
    retryDelay: this.retryDelay,
    timeout: this.timeout
  }, function(err, response, body) {
    if (!err && response.statusCode == 200) {
      var info = JSON.parse(body);

      this.JPService
        .getCharacteristic(Characteristic.PositionState).updateValue(parseInt(info.state));
      this.log('state is currently %d', parseInt(info.state));
      this.JPService
        .getCharacteristic(Characteristic.TargetPosition).updateValue(parseInt(info.target));
      this.log('target is currently %d', parseInt(info.target));

      this.log('position is currently %d', parseInt(info.pow));
      callback(null, parseInt(info.pow)); // success
    } else {
      this.log("Error getting position: %s %s", this.status_url, err);
      callback(err);
    }
  }.bind(this));
}

Http_jphsb.prototype.setTargetPosition = function(pos, callback) {
  this.log("moving blinds...");
  var url = this.move_url.replace('%p', pos);

  request.get({
    url: url,
    pool: ReqPool[this.poolnumber],
    maxAttempts: this.maxAttempts,
    retryDelay: this.retryDelay,
    timeout: this.timeout
  }, function(err, response, body) {
    if (!err && response.statusCode == 200) {
      this.log("curtain move to %s sent.", pos);
      callback(null); // success
    } else {
      this.log("Error moving curtains: %s %s", url, err);
      callback(err || new Error("Error moving curtains"));
    }
  }.bind(this));
}

/////////////////////////////////////////////////////////////////////
// Thermostat
/////////////////////////////////////////////////////////////////////

Http_jphsb.prototype.getCurrentHeatingCoolingState = function(callback) {
  this.log("getCurrentHeatingCoolingState");
  request.get({
    url: this.status_url,
    pool: ReqPool[this.poolnumber],
    maxAttempts: this.maxAttempts,
    retryDelay: this.retryDelay,
    timeout: this.timeout
  }, function(err, response, body) {
    if (!err && response.statusCode == 200) {
      try {
        var json = JSON.parse(body); //{targetHeatingCoolingState":3,"currentHeatingCoolingState":0,"targetTemperature":10,"temperature":12,"humidity":98}
        this.log("currentHeatingCoolingState is %s", json.currentHeatingCoolingState);
        this.currentHeatingCoolingState = json.currentHeatingCoolingState;
        this.JPService.setCharacteristic(Characteristic.CurrentHeatingCoolingState, this.currentHeatingCoolingState);
        callback(null, this.currentHeatingCoolingState); // success
      } catch (e) {
        this.log('error in parsing response getCurrentHeatingCoolingState');
        callback(null, 0); // assume 0
      }
    } else {
      this.log("Error getting CurrentHeatingCoolingState: %s", err);
      callback(err);
    }
  }.bind(this));
}

Http_jphsb.prototype.getTargetHeatingCoolingState = function(callback) {
  this.log("getTargetHeatingCoolingState");
  request.get({
    url: this.status_url,
    pool: ReqPool[this.poolnumber],
    maxAttempts: this.maxAttempts,
    retryDelay: this.retryDelay,
    timeout: this.timeout
  }, function(err, response, body) {
    if (!err && response.statusCode == 200) {
      try {
        var json = JSON.parse(body); //{"targetHeatingCoolingState":3,"currentHeatingCoolingState":0,"targetTemperature":10,"temperature":12,"humidity":98}
        this.log("TargetHeatingCoolingState received is %s", json.targetHeatingCoolingState);
        this.targetHeatingCoolingState = json.targetHeatingCoolingState;
        callback(null, this.targetHeatingCoolingState); // success
      } catch (e) {
        this.log('error in parsing response getTargetHeatingCoolingState');
        callback(null, 0); // assume 0
      }
    } else {
      this.log("Error getting TargetHeatingCoolingState: %s", err);
      callback(err);
    }
  }.bind(this));
}

Http_jphsb.prototype.setTargetHeatingCoolingState = function(value, callback) {
  if (value === undefined) {
    callback(); //Some stuff call this without value doing shit with the rest
  } else {
    this.log("setTargetHeatingCoolingState from/to:", this.targetHeatingCoolingState, value);
    var url = this.heatingstate_url.replace('%s', value);

    request.get({
      url: url,
      pool: ReqPool[this.poolnumber],
      maxAttempts: this.maxAttempts,
      retryDelay: this.retryDelay,
      timeout: this.timeout
    }, function(err, response, body) {
      if (!err && response.statusCode == 200) {
        this.log("response success");
        this.targetHeatingCoolingState = value;
        callback(null); // success
      } else {
        this.log("Error setting state: %s", err);
        callback(err);
      }
    }.bind(this));
  }
}

Http_jphsb.prototype.getCurrentTemperature = function(callback) {
  this.log("getCurrentTemperature");

  request.get({
    url: this.status_url,
    pool: ReqPool[this.poolnumber],
    maxAttempts: this.maxAttempts,
    retryDelay: this.retryDelay,
    timeout: this.timeout
  }, function(err, response, body) {
    if (!err && response.statusCode == 200) {
      try {
        var json = JSON.parse(body); //{targetHeatingCoolingState":3,"currentHeatingCoolingState":0,"temperature":"18.10","humidity":"34.10"}
        this.log("CurrentTemperature %s", json.currentTemperature);
        this.currentTemperature = parseFloat(json.currentTemperature);
        callback(null, this.currentTemperature); // success
      } catch (e) {
        this.log('error in parsing response getCurrentTemperature');
        callback(null, 0); // assume 0
      }
    } else {
      this.log("Error getting temp: %s", err);
      callback(err);
    }
  }.bind(this));
}

Http_jphsb.prototype.getTargetTemperature = function(callback) {
  this.log("getTargetTemperature");
  request.get({
    url: this.status_url,
    pool: ReqPool[this.poolnumber],
    maxAttempts: this.maxAttempts,
    retryDelay: this.retryDelay,
    timeout: this.timeout
  }, function(err, response, body) {
    if (!err && response.statusCode == 200) {
      try {
        var json = JSON.parse(body); //{targetHeatingCoolingState":3,"currentHeatingCoolingState":0"temperature":"18.10","humidity":"34.10"}
        this.targetTemperature = parseFloat(json.targetTemperature);
        this.log("Target temperature is %s", this.targetTemperature);
        callback(null, this.targetTemperature); // success
      } catch (e) {
        this.log('error in parsing response getTargetTemperature');
        callback(null, 0); // assume 0
      }
    } else {
      this.log("Error getting target temp: %s", err);
      callback(err);
    }
  }.bind(this));
}

Http_jphsb.prototype.setTargetTemperature = function(value, callback) {
  this.log("setTargetTemperature to %s", value);

  var url = this.temp_url.replace('%s', value);

  request.get({
    url: url,
    pool: ReqPool[this.poolnumber],
    maxAttempts: this.maxAttempts,
    retryDelay: this.retryDelay,
    timeout: this.timeout
  }, function(err, response, body) {
    if (!err && response.statusCode == 200) {
      this.log("response success");
      callback(null); // success
    } else {
      this.log("Error setting target temp: %s", err);
      callback(err);
    }
  }.bind(this));
}

Http_jphsb.prototype.getTemperatureDisplayUnits = function(callback) {
  this.log("getTemperatureDisplayUnits:", this.temperatureDisplayUnits);
  var error = null;
  callback(error, this.temperatureDisplayUnits);
}

Http_jphsb.prototype.setTemperatureDisplayUnits = function(value, callback) {
  this.log("setTemperatureDisplayUnits from %s to %s", this.temperatureDisplayUnits, value);
  this.temperatureDisplayUnits = value;
  var error = null;
  callback(error);
}

/////////////////////////////////////////////////////////////////////
// leak detector
/////////////////////////////////////////////////////////////////////

Http_jphsb.prototype.getLeakState = function(callback) {
  callback(null, this.leakDetected);
};

/////////////////////////////////////////////////////////////////////
// contact detector
/////////////////////////////////////////////////////////////////////

Http_jphsb.prototype.getContactState = function(callback) {
  callback(null, !this.ContactDetected);
};

/////////////////////////////////////////////////////////////////////
//
/////////////////////////////////////////////////////////////////////

Http_jphsb.prototype.getServices = function() {
  return [this.JPService];
}
