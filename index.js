// A homebridge plugin that create an HomeKit power consumption accessory mapped on MQTT topics.
// Based on homebridge-mqtt-power-consumption and homebridge-mqtt-power-consumption-log-tasmota 0.9.3.
// Adopted to work with a Tasmota device via MQTT to collect current Power and total Power consumption.
// Updated: 2023/02/15 Gerhard Stegemann

'use strict';
var inherits = require('util').inherits;
var Service, Characteristic;
var mqtt = require('mqtt');



module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;

    homebridge.registerAccessory('homebridge-mqtt-power-consumption', 'mqtt-power-consumption', MqttPowerConsumptionAccessory);
};

function MqttPowerConsumptionAccessory(log, config) {
    this.log = log;
    this.name = config['name'];
    this.url = config['url'];
    this.manufacturer = config['manufacturer'];
    this.model = config['model'];
    this.serialNumberMAC = config['serialNumberMAC'];
    this.meterInstance = String(config['meterInstance']);
    this.logMqtt = config['logMqtt'];
    this.client_Id = 'mqttjs_' + Math.random().toString(16).substr(2, 8);
    this.options = {
        keepalive: 10,
        clientId: this.client_Id,
        protocolId: 'MQTT',
        protocolVersion: 4,
        clean: true,
        reconnectPeriod: 1000,
        connectTimeout: 30 * 1000,
        will: {
            topic: 'WillMsg',
            payload: 'Connection Closed abnormally..!',
            qos: 0,
            retain: false
        },
        username: config['username'],
        password: config['password'],
        rejectUnauthorized: false
    };

  if (config["activityTopic"] !== undefined) {
    this.activityTopic = config['activityTopic'];
    this.activityParameter = config['activityParameter'];
  } else {
    this.activityTopic = "";
    this.activityParameter = "";
  }

    this.powerConsumption = 0;
    this.totalPowerConsumption = 0;
    this.topics = config['topics'];

    var EvePowerConsumption = function() {
        Characteristic.call(this, 'Consumption', 'E863F10D-079E-48FF-8F27-9C2605A29F52');
        this.setProps({
            format: Characteristic.Formats.UINT16,
            unit: 'watts',
            maxValue: 1000000000,
            minValue: 0,
            minStep: 1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    inherits(EvePowerConsumption, Characteristic);

    var EveTotalPowerConsumption = function() {
        Characteristic.call(this, 'Total Consumption', 'E863F10C-079E-48FF-8F27-9C2605A29F52');
        this.setProps({
            format: Characteristic.Formats.FLOAT, // Deviation from Eve Energy observed type
            unit: 'kilowatthours',
            maxValue: 1000000000,
            minValue: 0,
            minStep: 0.001,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };
    inherits(EveTotalPowerConsumption, Characteristic);

    var PowerMeterService = function(displayName, subtype) {
        Service.call(this, displayName, '00000001-0000-1777-8000-775D67EC4377', subtype);
        this.addCharacteristic(EvePowerConsumption);
        this.addOptionalCharacteristic(EveTotalPowerConsumption);
    if (this.activityTopic !== "") {
      this.addOptionalCharacteristic(Characteristic.StatusActive)
    }
    };

    inherits(PowerMeterService, Service);

    this.service = new PowerMeterService(this.options['name']);
    this.service.getCharacteristic(EvePowerConsumption).on('get', this.getPowerConsumption.bind(this));
    this.service.addCharacteristic(EveTotalPowerConsumption).on('get', this.getTotalPowerConsumption.bind(this));
    if (this.activityTopic !== "") {
      this.service.getCharacteristic(Characteristic.StatusActive).on('get', this.getStatusActive.bind(this))
    }

    this.client = mqtt.connect(this.url, this.options);

    var self = this;

    this.client.on('error', function (err) {
        self.log('Error event on MQTT:', err);
    });

    this.client.on('message', function (topic, message) {
      var data = null;
      if (topic == self.topics['power'] || topic == self.topics['totalPower']) {
        try {
          data = JSON.parse(message);
        }
        catch (e) {
          self.log("JSON problem");
        }
        if (data === null) {
          return null
        }
        if (self.logMqtt == true) {
          // Debug MQTT data
          self.log("mqtt-power-consumption: message payload:", data)
        }
        if (data.hasOwnProperty(self.meterInstance)) {
          // Update based on Tasmota tele/sonoff/SENSOR JSON response
          data = data[self.meterInstance];  // Select configured meter
        }
      }
      if (topic == self.topics['power']) {
         // self.powerConsumption = parseFloat(message.toString());
        if (data.hasOwnProperty("Power_curr")) {
          self.powerConsumption = parseFloat(data.Power_curr);
          self.service.setCharacteristic(EvePowerConsumption, self.powerConsumption);
        } else {
          return null
        }
        self.service.getCharacteristic(EvePowerConsumption).setValue(self.powerConsumption, undefined, undefined);
      }

      if (topic == self.topics['totalPower']) {
         // self.totalPowerConsumption = parseFloat(message.toString());
        if (data.hasOwnProperty("Total_in")) {
          self.totalPowerConsumption = parseFloat(data.Total_in);
          self.service.setCharacteristic(EveTotalPowerConsumption, self.totalPowerConsumption);
        } else {
          return null
        }
        self.service.getCharacteristic(EveTotalPowerConsumption).setValue(self.totalPowerConsumption, undefined, undefined);
      }
      if (topic == self.activityTopic) {
        var status = message.toString();
        self.activeStat = status == self.activityParameter;
        self.service.setCharacteristic(Characteristic.StatusActive, self.activeStat);
        self.service.getCharacteristic(Characteristic.StatusActive).setValue(self.activeStat, undefined, undefined);
      }
    });

    if (self.topics['power'] !== undefined) {
        this.client.subscribe(self.topics['power']);
    }

    if (self.topics['totalPower'] !== undefined) {
        this.client.subscribe(self.topics['totalPower']);
    }

    if (this.activityTopic !== "") {
      this.client.subscribe(this.activityTopic);
    }
}

MqttPowerConsumptionAccessory.prototype.getPowerConsumption = function (callback) {
    callback(null, this.powerConsumption);
};

MqttPowerConsumptionAccessory.prototype.getTotalPowerConsumption = function (callback) {
    callback(null, this.totalPowerConsumption);
};

MqttPowerConsumptionAccessory.prototype.getStatusActive = function(callback) {
  callback(null, this.activeStat);
};

MqttPowerConsumptionAccessory.prototype.getServices = function () {

var informationService = new Service.AccessoryInformation();

  informationService
    .setCharacteristic(Characteristic.Name, this.name)
    .setCharacteristic(Characteristic.Manufacturer, this.manufacturer)
    .setCharacteristic(Characteristic.Model, this.model)
    .setCharacteristic(Characteristic.SerialNumber, this.serialNumberMAC);

  return [informationService, this.service];
};
