var request = require("request");
var Service, Characteristic;
var ReqPool = {maxSockets:5};

module.exports = function(homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;

	homebridge.registerAccessory("homebridge-http-JPHSB", "http-JPHSB", Http_jphsb);
}

function Http_jphsb(log, config) {
	this.log = log;
	this.name = config["name"];

	// url info
	this.on_url = config["on_url"];
	this.off_url = config["off_url"];
	this.status_url = config["status_url"];
	this.brightness = config["brightness"] || "no";
	this.setbrightness_url = config["setbrightness_url"];
	this.getbrightness_url = config["getbrightness_url"];
	this.hue = config["hue"] || "no";
	this.sethue_url = config["sethue_url"];
	this.gethue_url = config["gethue_url"];
	this.saturation = config["saturation"] || "no";
	this.setsaturation_url = config["setsaturation_url"];
	this.getsaturation_url = config["getsaturation_url"];
	this.service = config["service"] || "Switch";
    this.timeout = config["timeout"] || 2500;

	switch (this.service) {
			case "Switch":
					this.log('creating Switch');
					this.switchService = new Service.Switch(this.name);
					this.switchService
							.getCharacteristic(Characteristic.On)
							.on('get', this.getPowerState.bind(this))
							.on('set', this.setPowerState.bind(this));
					return [this.switchService];
					break;
			case "Light":
					this.log('creating Lightbulb');
					this.lightbulbService = new Service.Lightbulb(this.name);
					this.lightbulbService
							.getCharacteristic(Characteristic.On)
							.on('get', this.getPowerState.bind(this))
							.on('set', this.setPowerState.bind(this));
					if (this.brightness == "yes") {
							this.log('... adding Brightness');
							this.lightbulbService
									.addCharacteristic(Characteristic.Brightness)
									.on('get', this.getBrightness.bind(this))
									.on('set', this.setBrightness.bind(this));
					}
					if (this.hue == "yes") {
							this.log('... adding hue');
							this.lightbulbService
									.addCharacteristic(Characteristic.Hue)
									.on('get', this.getHue.bind(this))
									.on('set', this.setHue.bind(this));
					}
					if (this.saturation == "yes") {
							this.log('... adding saturation');
							this.lightbulbService
									.addCharacteristic(Characteristic.Saturation)
									.on('get', this.getSaturation.bind(this))
									.on('set', this.setSaturation.bind(this));
					}
					break;
	}

}

Http_jphsb.prototype.getPowerState = function(callback) {
	this.log("Getting power state...");

	request.get({
		url: this.status_url,
        pool: ReqPool,
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
        pool: ReqPool,
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
},

Http_jphsb.prototype.getHue = function(callback) {
	this.log("Getting hue...");

	request.get({
		url: this.gethue_url,
        pool: ReqPool,
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
        pool: ReqPool,
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
},

Http_jphsb.prototype.getBrightness = function(callback) {
	this.log("Getting brightness...");

	request.get({
		url: this.getbrightness_url,
        pool: ReqPool,
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
        pool: ReqPool,
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
},

Http_jphsb.prototype.getSaturation = function(callback) {
	this.log("Getting Saturation...");

	request.get({
		url: this.getsaturation_url,
        pool: ReqPool,
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
        pool: ReqPool,
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
},

Http_jphsb.prototype.getServices = function() {
	return [this.lightbulbService];
}
