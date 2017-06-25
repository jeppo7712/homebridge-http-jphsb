var request = require("requestretry");
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
    this.getbrightness_url = config["getbrightness_url"];
    this.hue = config["hue"] || "no";
    this.sethue_url = config["sethue_url"];
    this.gethue_url = config["gethue_url"];
    this.saturation = config["saturation"] || "no";
    this.setsaturation_url = config["setsaturation_url"];
    this.getsaturation_url = config["getsaturation_url"];
    // curtains sectopn
    this.move_url = config["move_url"];
    this.target_url = config["target_url"];
    this.state_url = config["state_url"];

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
                    .on('get', this.getBrightness.bind(this))
                    .on('set', this.setBrightness.bind(this));
            }
            if (this.hue == "yes") {
                this.log('... adding hue');
                this.JPService
                    .addCharacteristic(Characteristic.Hue)
                    .on('get', this.getHue.bind(this))
                    .on('set', this.setHue.bind(this));
            }
            if (this.saturation == "yes") {
                this.log('... adding saturation');
                this.JPService
                    .addCharacteristic(Characteristic.Saturation)
                    .on('get', this.getSaturation.bind(this))
                    .on('set', this.setSaturation.bind(this));
            }
            break;
        case "Blinds":
            this.log('creating Blinds');
            this.interval = null;
            this.timeout = null;
            this.lastPosition = 0; // last known position of the blinds, down by default
            this.currentPositionState = 2; // stopped by default
            this.currentTargetPosition = 0; // down by default

            this.log("Getting current blinds position...");
            request.get({
                url: this.status_url,
                pool: ReqPool[this.poolnumber],
                maxAttempts: this.maxAttempts,
                retryDelay: this.retryDelay,
                timeout: this.timeout
            }, function(err, response, body) {
                if (!err && response.statusCode == 200) {
                    this.lastPosition = parseInt(body);
                    this.log('position is currently %d', this.lastPosition);
                } else {
                    this.log("Error getting position: %s %s", this.status_url, err);
                }
            }.bind(this));

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
                .on('get', this.getPositionState.bind(this));

            // the target position (0-100%)
            // https://github.com/KhaosT/HAP-NodeJS/blob/master/lib/gen/HomeKitTypes.js#L1564
            this.JPService
                .getCharacteristic(Characteristic.TargetPosition)
                .on('get', this.getTargetPosition.bind(this))
                .on('set', this.setTargetPosition.bind(this));
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
            var powerOn = parseInt(body) > 0;
            this.log('power is currently %s', powerOn ? 'ON' : 'OFF');
            callback(null, powerOn); // success
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

Http_jphsb.prototype.getHue = function(callback) {
    this.log("Getting hue...");

    request.get({
        url: this.gethue_url,
        pool: ReqPool[this.poolnumber],
        maxAttempts: this.maxAttempts,
        retryDelay: this.retryDelay,
        timeout: this.timeout
    }, function(err, response, body) {
        if (!err && response.statusCode == 200) {
            var level = parseInt(body);
            this.log('hue is currently %s', level);
            callback(null, level); // success
        } else {
            this.log("Error getting hue : %s %s", this.gethue_url, err);
            callback(err);
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

Http_jphsb.prototype.getBrightness = function(callback) {
    this.log("Getting brightness...");

    request.get({
        url: this.getbrightness_url,
        pool: ReqPool[this.poolnumber],
        maxAttempts: this.maxAttempts,
        retryDelay: this.retryDelay,
        timeout: this.timeout
    }, function(err, response, body) {
        if (!err && response.statusCode == 200) {
            var level = parseInt(body);
            this.log('brightness is currently %s', level);
            callback(null, level); // success
        } else {
            this.log("Error getting brightness: %s %s", this.getbrightness_url, err);
            callback(err);
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

Http_jphsb.prototype.getSaturation = function(callback) {
    this.log("Getting Saturation...");

    request.get({
        url: this.getsaturation_url,
        pool: ReqPool[this.poolnumber],
        maxAttempts: this.maxAttempts,
        retryDelay: this.retryDelay,
        timeout: this.timeout
    }, function(err, response, body) {
        if (!err && response.statusCode == 200) {
            var level = parseInt(body);
            this.log('Saturation is currently %s', level);
            callback(null, level); // success
        } else {
            this.log("Error getting Saturation : %s %s", this.getsaturation_url, err);
            callback(err);
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
            this.lastPosition = parseInt(body);
            this.log('position is currently %d', this.lastPosition);
            callback(null, this.lastPosition); // success
        } else {
            this.log("Error getting position: %s %s", this.status_url, err);
            callback(err);
        }
    }.bind(this));
}

Http_jphsb.prototype.getPositionState = function(callback) {
    this.log("Getting current state...");
    request.get({
        url: this.state_url,
        pool: ReqPool[this.poolnumber],
        maxAttempts: this.maxAttempts,
        retryDelay: this.retryDelay,
        timeout: this.timeout
    }, function(err, response, body) {
        if (!err && response.statusCode == 200) {
            this.currentPositionState = parseInt(body);
            this.log('state is currently %d', this.currentPositionState);
            callback(null, this.currentPositionState); // success
        } else {
            this.log("Error getting state: %s %s", this.state_url, err);
            callback(err);
        }
    }.bind(this));
}

Http_jphsb.prototype.getTargetPosition = function(callback) {
    this.log("Getting target position...");
    request.get({
        url: this.target_url,
        pool: ReqPool[this.poolnumber],
        maxAttempts: this.maxAttempts,
        retryDelay: this.retryDelay,
        timeout: this.timeout
    }, function(err, response, body) {
        if (!err && response.statusCode == 200) {
            this.currentTargetPosition = parseInt(body);
            this.log('target is currently %d', this.currentTargetPosition);
            callback(null, this.currentTargetPosition); // success
        } else {
            this.log("Error getting state: %s %s", this.target_url, err);
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


Http_jphsb.prototype.getServices = function() {
    return [this.JPService];
}
