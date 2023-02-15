# homebridge-mqtt-power-consumption
An homebridge plugin that create an HomeKit power consumption accessory mapped on MQTT topics.
Based on homebridge-mqtt-power-consumption and homebridge-mqtt-power-consumption-log-tasmota 0.9.3.
Adopted to work with a Tasmota device via MQTT to collect current Power and total Power consumption.

# Installation
Follow the instruction in [homebridge](https://www.npmjs.com/package/homebridge) for the homebridge server installation.
The plugin is published through [NPM](https://www.npmjs.com/package/homebridge-mqtt-power-consumption) and should be installed "globally" by typing:

    npm install -g homebridge-mqtt-power-consumption

# Configuration
Remember to configure the plugin in config.json in your home directory inside the .homebridge directory. Configuration parameters:
```javascript
{
  "accessory": "mqtt-power-consumption",
  "name": "<name of the power-consumption>",
  "manufacturer": "<Manufacturer of Meter",
  "model": "<Model of meter>",
  "serialNumberMAC": "<Serial number of device>",
  "meterInstance": "<e.g. MQTT Prefix in Tasmota configuration>",
  "logMqtt": true | false,
  "url": "<url of the broker>", // i.e. "http://mosquitto.org:1883"
  "username": "<username>",
  "password": "<password>",
  "topics": {
    "power": "<topic to get the current power consumption>",
    "totalPower": "<topic to get the total power consumption>"
  }
  "activityTopic": "<topic to get the actity state of device>", // i.e. "tele/tasmota/LWT",
  "activityParameter": "Online"
}
```

# Info
Uses special characteristics of the Eve power outlet. Apples Home app does not show special characteristic, power consumption
will only be displayed in the eve app.
