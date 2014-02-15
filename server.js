// server.js - NodeJS server for the PiPresenceServer project.
// forked from https://github.com/talltom/PiThermServer

/* 

A Bluetooth LE peripheral is set up with a writable characteristic. The pheripheral is detected from the iOS-App which tries to connect and writes a value every second. A timestamp is logged to the DB every time the app connects or the connection is lost.
The records from the DB are servec via node-static in JSON-format.

Aevoid 15.02.2014
Ref: http://mfg.fhstp.ac.at/development/bluetooth-le-presence-detection-mit-ios-und-raspberry-pi/
*/

// Load node modules
var fs = require('fs');
var sys = require('sys');
var http = require('http');
var sqlite3 = require('sqlite3');
var util = require('util');
var bleno = require('bleno');


global.timeout = 0;
global.present = 0;


// Use node-static module to server chart for client-side dynamic graph
var nodestatic = require('node-static');

// Setup static server for current directory
var staticServer = new nodestatic.Server(".");

// Setup database connection for logging
var db = new sqlite3.Database('./presence.db');




// Write a single record in JSON format to database table.
function insertData(data){
	//console.log(data);
   // data is a javascript object   
   var statement = db.prepare("INSERT INTO presence_records VALUES (?, ?)");
   // Insert values into prepared statement
   statement.run(data.unix_time, data.present);
   // Execute the statement
   statement.finalize();
}









// Get records from database
function selectRecords(num_records, start_date, callback){
   // - Num records is an SQL filter from latest record back trough time series, 
   // - start_date is the first date in the time-series required, 
   // - callback is the output function
   var current_rec = db.all("SELECT * FROM (SELECT * FROM presence_records WHERE unix_time > (strftime('%s',?)*1000) ORDER BY unix_time DESC LIMIT ?) ORDER BY unix_time;", start_date, num_records,
      function(err, rows){
         if (err){
			   response.writeHead(500, { "Content-type": "text/html" });
			   response.end(err + "\n");
			   console.log('Error serving querying database. ' + err);
			   return;
				      }
         data = {presence_record:[rows]}
         callback(data);
   });
};





// Set up characteristic
var StaticReadOnlyCharacteristic = function() {
  StaticReadOnlyCharacteristic.super_.call(this, {
    uuid: '63DD008C17904799A684F07D5CE963E1',
    properties: ['read'],
    value: new Buffer('value'),
    descriptors: [
      new bleno.Descriptor({
        uuid: '2901',
        value: 'user description'
      })
    ]
  });
};
util.inherits(StaticReadOnlyCharacteristic, bleno.Characteristic);

var DynamicReadOnlyCharacteristic = function() {
  DynamicReadOnlyCharacteristic.super_.call(this, {
    uuid: '63DD008C17904799A684F07D5CE963E2',
    properties: ['read']
  });
};

util.inherits(DynamicReadOnlyCharacteristic, bleno.Characteristic);

DynamicReadOnlyCharacteristic.prototype.onReadRequest = function(offset, callback) {
  var result = this.RESULT_SUCCESS;
  var data = new Buffer('dynamic value');

  if (offset > data.length) {
    result = this.RESULT_INVALID_OFFSET;
    data = null;
  }

  callback(result, data);
};

var WriteOnlyCharacteristic = function() {
  WriteOnlyCharacteristic.super_.call(this, {
    uuid: '63DD008C17904799A684F07D5CE963E3',
    properties: ['write']//, 'writeWithoutResponse']
  });
};

util.inherits(WriteOnlyCharacteristic, bleno.Characteristic);

WriteOnlyCharacteristic.prototype.onWriteRequest = function(data, offset, withoutResponse, callback) {
	var start = new Date();
	//console.log(start.toLocaleString());
	//console.log('WriteOnlyCharacteristic write request: ' + data.toString('hex') + ' ' + offset + ' ' + withoutResponse);

	// log a "presence detected" when first value written
	if(!global.present){
     	console.log('checkPresence, 1');
     	global.present = 1;
     	var data = {
            unix_time: Date.now(),
            present: 0
            };
        // write 0
        insertData(data);
        data.unix_time++;
        data.present=1;
        // write 1
        insertData(data);
	 }
	
	// clear Timeout
	if(global.timeout)
		clearTimeout(global.timeout);
	
	// setup Timeout that logs a "connection lost" when no value written for msecs milliseconds 
	global.timeout = setTimeout(function(){
		console.log('checkPresence, 0');
	 	global.present = 0;
	 	var data = {
            unix_time: Date.now(),
            present: 1
            };
        // write 1
        insertData(data);
        data.unix_time++;
        data.present=0;
        // write 0
        insertData(data);
	}, msecs);

	callback(this.RESULT_SUCCESS);
};

// Set up Service
function SampleService() {
	SampleService.super_.call(this, {
		uuid: '63DD008C17904799A684F07D5CE963E0',
		characteristics: [
			new StaticReadOnlyCharacteristic(),   
			new DynamicReadOnlyCharacteristic(),
			new WriteOnlyCharacteristic()
		]
	});
}

util.inherits(SampleService, bleno.PrimaryService);

// Set up Bluetooth LE peripheral
bleno.on('stateChange', function(state) {
	console.log('on -> stateChange: ' + state);
	var primaryService = new SampleService();
	//bleno.setServices([primaryService]);
	
	if (state === 'poweredOn') {
		bleno.startAdvertising('ble-pres',['63DD008C17904799A684F07D5CE963E0']);
	} else {
		bleno.stopAdvertising();
	}
});

bleno.on('advertisingStart', function(error) {
	var start = new Date();
	console.log(start.toLocaleString());
	console.log('on -> advertisingStart ' + (error ? 'error ' + error : 'success'));
	
	if (!error) {
		bleno.setServices([
			new SampleService()
		]);
	}
});

bleno.on('advertisingStop', function() {
	console.log('on -> advertisingStop');
});

bleno.on('servicesSet', function(error) {
	console.log('on -> servicesSet ' + (error ? 'error ' + error : 'success'));
});






// Setup node http server
var server = http.createServer(
	// Our main server function
	function(request, response)
	{
		// Grab the URL requested by the client and parse any query options
		var url = require('url').parse(request.url, true);
		var pathfile = url.pathname;
		var query = url.query;
		
		// Test to see if it's a database query
		if (pathfile == '/presence_query.json'){
			// Test to see if number of observations was specified as url query
			if (query.num_obs){
				var num_obs = parseInt(query.num_obs);
			}
			else{
				// If not specified default to 20. Note use -1 in query string to get all.
				var num_obs = -1;
			}
			if (query.start_date){
				var start_date = query.start_date;
			}
			else{
				var start_date = '1970-01-01T00:00';
			}   
			// Send a message to console log
			console.log('Database query request from '+ request.connection.remoteAddress +' for ' + num_obs + ' records from ' + start_date+'.');
			// call selectRecords function to get data from database
			selectRecords(num_obs, start_date, function(data){
					response.writeHead(200, { "Content-type": "application/json" });		
					response.end(JSON.stringify(data), "ascii");
				});
			return;
		}
		
		// Handler for favicon.ico requests
		if (pathfile == '/favicon.ico'){
			response.writeHead(200, {'Content-Type': 'image/x-icon'});
			response.end();
		
			// Optionally log favicon requests.
			//console.log('favicon requested');
			return;
		}
		
		
		else {
			// Print requested file to terminal
			console.log('Request from '+ request.connection.remoteAddress +' for: ' + pathfile);
		
			// Serve file using node-static			
			staticServer.serve(request, response, function (err, result) {
				if (err){
					// Log the error
					sys.error("Error serving " + request.url + " - " + err.message);
					
					// Respond to the client
					response.writeHead(err.status, err.headers);
					response.end('Error 404 - file not found');
					return;
				}
				return;	
			})
		}
});




// Start presence logging
var msecs = (1.5) * 1000; // log interval duration in milliseconds

// Send a message to console
console.log('PiPresenceServer is logging to database at '+msecs+'ms intervals');
// Enable server
server.listen(8000);
// Log message
console.log('Server running at http://localhost:8000');
console.log('Exit with Ctrl-C');


// Add date/time to data
var data = {
	unix_time: Date.now(),
	present: 0
	};
// write 0
insertData(data);
console.log('Initial value written');

process.env.TZ = 'Europe/Amsterdam';
//console.log(Date.now());

process.on( 'SIGINT', function() {
  console.log( "\nGracefully shutting down from SIGINT (Ctrl-C)" );
  // some other closing procedures go here
  if (global.present){
  	var data = {
		unix_time: Date.now(),
		present: 1
	};
	insertData(data);
	data.unix_time++;
	data.present=0;
	insertData(data);
	// timeout to allow saving of data
	setTimeout(process.exit,200);
  }
  else
  	process.exit();
})