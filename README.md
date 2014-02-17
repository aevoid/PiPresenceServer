PiPresenceServer
================

Simple NodeJS server and SQLite3 logger for Bluetooth LE Presence on the Raspberry Pi to use together with [iOSBLEPresence](https://github.com/aevoid/iOSBLEPresence).

Description
-----------
A NodeJS server for Bluetooth LE Presence detection on the Raspberry Pi. The presence is detected via Bluetooth Low Energy. The server starts a Bluetooth LE Peripheral with a writable characteristic. The iOS-App detects the peripheral, connects to it and writes a value every second. A Unix time-stamp in JSON format is logged to the SQLite database every time the smartphone connects or the connection is lost. A simple front-end is included and served using node-static, which performs ajax calls to the server/database and plots presence in real time or from a time-series, using the highcharts JavaScript library.

Files
-----
* server.js - NodeJS server, returns presence timestamps as JSON, logs to database and serves other static files
* presence_log.htm - client front-end showing time-series from database records
* build_database.sh - shell script to create database schema
* sample_database.db - example database with real world data from the Pi recorded in UK Jan-Feb 2013

Requirements
------------
* Raspberry Pi
* Bluetooth LE (4.0) USB Adapter

Dependencies
------------
* NodeJS
* SQLite3
* node-sqlite3
* node-static
* node-bleno

Install/Setup
-------------
1. Run `npm install` in this directory
2. Run the `build_database.sh` script to create "presence.db". Note this wil drop any existing database of the same name in the directory
3. In a terminal run "node server.js" to start the server.
4. Open a web browser on the Pi and go to http://localhost:8000/presence_log.htm to see a plot of logged presence timestamps. 

References
----------
http://mfg.fhstp.ac.at/development/bluetooth-le-presence-detection-mit-ios-und-raspberry-pi/

Screenshots/Images
------------------

