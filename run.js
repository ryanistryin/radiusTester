
//libs for radius
var radius = require('radius');
var dgram = require('dgram');
var util = require('util');
var Chance = require('chance');
var chance = new Chance();
var requestify = require('requestify');



var client = dgram.createSocket("udp4");
client.bind(49003);






var uniqueMacAddress = [];



//our nas' details
var nas = {
	'ipAddress' : '192.168.0.1',
	'macAddress' : 'AA:BB:CC:DD:EE:FF',
	'identifier' : 'myNasID',
	'portType' : 'Wireless-802.11',
	'portId' : 'ether1',


}
var secret = 'testing123'; //radius secret
//some config options
var config = {
	'nasSpeed' : "409600", //this is the "speed" at which the NAS has allocated to it. It helps get more *realistic* results for data consumed. i.e. a user cannot have download 1000MB in 60 seconds (the interim-update value) if it was 4mbps line...
	'acctSessionID' : 10000000, //because im useless & lazy and this is easy. we will increment this per acct session
	'acctInterimUpdate' : 10000,//the acct-interim-update equivilant
}


var sent_packets = {};//keep track of packets sent


var clients = {}


//example of clients array

// clients[0] = {
// 	"username" : "naruto",
// 	"password" : "test",
// }
// clients[1] = {
// 	"username" : "kakashi",
// 	"password" : "test",

// }
// clients[2] = {
// 	"username" : "sasuke",
// 	"password" : "test",

// }
// clients[3] = {
// 	"username" : "sakura",
// 	"password" : "test",
// }


//function that returns the "hold off period" period between acct sessions. this is to simulate users that dont all login at exactly the same time
function randomWaitTime() {
	//the bigger the difference between high & low, the more "unique" the users start time will be

	var high = 10000;
	var low = 1;
	return  Math.floor((Math.random() * high) + low);
}


//function that does accounting updates
function doAcctUpdate(i) {

	clients[i].timerid =	setInterval(function() {
			updateSession(i);
			//create a properly formulated packet
			var packet = {
				code: "Accounting-Request",
				secret: secret,
				identifier: i,
				attributes: [
					['NAS-IP-Address', nas.ipAddress], //generate correct IP address for this
					['User-Name', clients[i].username],
					['Acct-Status-Type','Interim-Update'], //needs to be start, interim-update or stop
					['NAS-Port-Type',nas.portType],
					['Calling-Station-Id',clients[i].macAddress], //client MAC
					['Called-Station-Id',nas.macAddress],
					['NAS-Port-Id',nas.portId],
					['Acct-Session-Id',clients[i].acctSessionID], //need to create unique accounting ids for each request
					['Framed-IP-Address',clients[i].ipAddress], //clients IP address must be unique
					['NAS-Identifier',nas.identifier],
					['Acct-Input-Octets',clients[i].acctInputOctets],
					['Acct-Output-Octets',clients[i].acctOutputOctets],
					['Acct-Session-Time',clients[i].acctSessionTime],

				]
			};
			// console.log('Accounting update for user ' + clients[i].username + '[' + packet.attributes + ']');
		//encode the radius packet and send to the server
		var encoded = radius.encode(packet);
		sent_packets[packet.identifier] = {
			raw_packet: encoded,
			secret: packet.secret
		};
		client.send(encoded, 0, encoded.length, 1813, "localhost");

	}, config.acctInterimUpdate);

};




//function that does accounting stop
function doAcctStop(i) {


			updateSession(i); //this is weird as proberbly not an entire interim-update will have come before the stop message is generated...shit
			//create a properly formulated packet
			var packet = {
				code: "Accounting-Request",
				secret: secret,
				identifier: i,
				attributes: [
					['NAS-IP-Address', nas.ipAddress], //generate correct IP address for this
					['User-Name', clients[i].username],
					['Acct-Status-Type','Stop'], //needs to be start, interim-update or stop
					['NAS-Port-Type',nas.portType],
					['Calling-Station-Id',clients[i].macAddress], //client MAC
					['Called-Station-Id',nas.macAddress],
					['NAS-Port-Id',nas.portId],
					['Acct-Session-Id',clients[i].acctSessionID], //need to create unique accounting ids for each request
					['Framed-IP-Address',clients[i].ipAddress], //clients IP address must be unique
					['NAS-Identifier',nas.identifier],
					['Acct-Input-Octets',clients[i].acctInputOctets],
					['Acct-Output-Octets',clients[i].acctOutputOctets],
					['Acct-Session-Time',clients[i].acctSessionTime],

				]
			};
			console.log('Stopping Accounting for user ' + clients[i].username + '[' + packet.attributes + ']');

		//encode the radius packet and send to the server
		var encoded = radius.encode(packet);
		sent_packets[packet.identifier] = {
			raw_packet: encoded,
			secret: packet.secret
		};

		//beware, if we get a stop request before accounting has started. the entire app will crash
		// console.log('crash now..')
		client.send(encoded, 0, encoded.length, 1813, "localhost");
		clients[i].acctDone = true;
		//do accounting update
			clearInterval(clients[i].timerid)

};




//function that does accounting Start
function doAcctStart(i) {

	//assign our user an Acct-Session-Id and increment base one so no-one else gets it
	clients[i].acctSessionID = config.acctSessionID;
	config.acctSessionID++;
	clients[i].acctInputOctets = 0;
	clients[i].acctOutputOctets = 0;
	clients[i].acctSessionTime = 0;

	clients[i].macAddress = chance.mac_address();
	clients[i].ipAddress = chance.ip();


			//create a properly formulated packet
			var packet = {
				code: "Accounting-Request",
				secret: secret,
				identifier: i,
				attributes: [
					['NAS-IP-Address', nas.ipAddress], //generate correct IP address for this
					['User-Name', clients[i].username],
					['Acct-Status-Type','Start'], //needs to be start, interim-update or stop
					['NAS-Port-Type',nas.portType],
					['Calling-Station-Id',clients[i].macAddress], //client MAC
					['Called-Station-Id',nas.macAddress],
					['NAS-Port-Id',nas.portId],
					['Acct-Session-Id',clients[i].acctSessionID], //need to create unique accounting ids for each request
					['Framed-IP-Address',clients[i].ipAddress], //clients IP address must be unique
					['NAS-Identifier',nas.identifier],
					['Acct-Output-Octets',clients[i].acctOutputOctets],
					['Acct-Input-Octets',clients[i].acctInputOctets],
					['Acct-Session-Time',clients[i].acctSessionTime],
				]
			};
			console.log('Starting Accounting for user ' + clients[i].username + '[' + packet.attributes + ']');

		//encode the radius packet and send to the server
		var encoded = radius.encode(packet);
		sent_packets[packet.identifier] = {
			raw_packet: encoded,
			secret: packet.secret
		};
		client.send(encoded, 0, encoded.length, 1813, "localhost");

};

//do radius authentication
function doRad(i) {

	//wait for a random amount of time. This helps to simulate real life users logging on randomly
	var t = randomWaitTime();
	setTimeout(function() {


			//do radius authentication
			console.log('doing auth for client ' + i + ' username: ' + clients[i].username);

				//create a properly formulated packet
				var packet = {
					code: "Access-Request",
					secret: secret,
					identifier: i,
					attributes: [
						['NAS-IP-Address', '10.5.5.5'], //generate correct IP address for this
						['User-Name', clients[i].username],
						['User-Password', clients[i].password]
					]
				};

			//encode the radius packet and send to the server
			var encoded = radius.encode(packet);
			sent_packets[packet.identifier] = {
				raw_packet: encoded,
				secret: packet.secret
			};
			client.send(encoded, 0, encoded.length, 1812, "localhost");

	}, t)

}



// get our users via API and start the process
function getStarted() {
        var c = 0;

        console.log('Starting APP')
        requestify.get('http://127.0.0.1:1337/Services/?limit=200')
        .then(function(response) {
            // Get the response body (JSON parsed or jQuery object for XMLs)
            // response.getBody();
            var data = response.getBody();
            data.forEach(function(line) {

                clients[c] = line;
                // console.log(clients)
                doRad(c);
                c++;
            })
            // console.log(clients)

        }
    );


}


getStarted();


//validate radius responses
client.on('message', function(msg, rinfo) {
  var response = radius.decode({packet: msg, secret: secret});
  var request = sent_packets[response.identifier];

  // although it's a slight hassle to keep track of packets, it's a good idea to verify
  // responses to make sure you are talking to a server with the same shared secret
  var valid_response = radius.verify_response({
    response: msg,
    request: request.raw_packet,
    secret: request.secret
  });

  //process the response
  if (valid_response) {

		//if we get Access-Accept then we send the accounting start packet
		if (response.code == 'Access-Accept') {
			console.log('user ' + clients[response.identifier].username + ' authenticated successfully.')
			doAcctStart(response.identifier);
		}
		//if we get Access-Reject then we do nothing
		if (response.code == 'Access-Reject') {
			console.log('Recieved a ' + response.code + ' for packet id ' + response.identifier + ' for username ' + clients[response.identifier].username + ' will not do accounting')
		}
		//if we get an Accounting-Response we send interim-updates and its not a STOP response (acctDone != true)
		if (response.code == 'Accounting-Response') {
			console.log('Recieved a ' + response.code + ' for packet id ' + response.identifier + ' for username ' + clients[response.identifier].username + ' doing accounting update')
			if ((clients[response.identifier].acct != true) && (clients[response.identifier].acctDone != true)) {
				clients[response.identifier].acct = true;
				doAcctUpdate(response.identifier)

			}
		}
		//got a bad response
  } else {
    console.log('WARNING: Got invalid response ' + response.code + ' for packet id ' + response.identifier + ' for username ' + clients[response.identifier].username);
		//here we need something that stops the requests as its going to get stuck in a loop
  }

});

//function that alters users downloaded & uploaded data & session time
function updateSession(i) {

	var high = config.nasSpeed;
	var low = 1;
	var speedDown = Math.floor((Math.random() * (high - low + 1)) + low) * (config.acctInterimUpdate / 1000);
	var speedUp = Math.floor((Math.random() * (high - low + 1)) + low) * (config.acctInterimUpdate / 1000);

	//update INPUT & OUTPUT OCTETS (not supporting Gigabit!!)
	clients[i].acctInputOctets += speedDown;
	clients[i].acctOutputOctets += speedUp;

	//update Session Time
	clients[i].acctSessionTime += config.acctInterimUpdate / 1000;

}


// Listen for RADIUS disconnect Messages. if disconnect is recieved then end the users session.
// This is weekly done it won't verify that the message came from the correct server & has basically no security.
var disconnectClient = dgram.createSocket("udp4")
disconnectClient.bind(3799);

disconnectClient.on('message', function(msg, rinfo) {
  var response = radius.decode({packet: msg, secret: secret});
	var disconnectUsername = response.attributes['User-Name'];
    console.log('Got a DISCONNECT MESSAGE! for username ' + disconnectUsername);

		for (var key in clients) {
			if (clients[key].username == disconnectUsername) {
				//once we have found the user ID (key) that we want to disconnect. We need to call the doACctStop(key) function and stop the accounting sesion for the user
				doAcctStop(key)
			}
		}

});
