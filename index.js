var request = require("request");
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

            var info = JSON.parse(body);
            if (this.brightness == "yes") {
                this.JPService
                    .getCharacteristic(Characteristic.Brightness).updateValue(parseInt(info.bri));
                this.log('brightness is currently %s', parseInt(info.bri));
            }
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
            this.log('power is currently %s', info.pow ? 'ON' : 'OFF');
            callback(null, parseInt(info.pow)); // success

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


Http_jphsb.prototype.getServices = function() {
    return [this.JPService];
}
