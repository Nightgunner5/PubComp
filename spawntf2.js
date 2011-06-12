var createConnection = require('net').createConnection,
	http = require('http'),
	io = require('socket.io'),
	fs = require('fs'),
	spawn = require('child_process').spawn,
	dgram = require("dgram"),
	tf2 = null,
	tf2_rcon = '',
	rcon_chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'.split( '' ),
	rcon = null,
	buffer = '',
	ip = 'nightgunner5.is-a-geek.net',
	rconbuffer = '',
	tf2state = 'unknown',
	map = 'cp_gravelpit';

function rconInt( num ) {
	return String.fromCharCode( num % 256, ( num >> 8 ) % 256, ( num >> 16 ) % 256, ( num >> 24 ) % 256 );
}

// Status 2 is normal, status 3 means password.
function rconSend( status, command ) {
	var packet = rconInt( 0 ) + rconInt( status ) + command + '\0\0';
	if ( rcon ) {
		rcon.write( rconInt( packet.length ) + packet );
		if ( rconbuffer ) {
			rcon.write( rconbuffer );
			rconbuffer = '';
		}
	} else {
		rconbuffer += rconInt( packet.length ) + packet;
	}
}

var log = dgram.createSocket( 'udp4' );
log.on( 'message', function( msg, rinfo ) {
	if ( rinfo.address != '127.0.0.2' || rinfo.port != 27015 )
		return;
	if ( msg.slice( 0, 7 ).toString( 'base64' ) != '/////1JMIA==' ) {
		console.log( '???: %s', msg );
		return;
	}
	var line = msg.slice( 7 ).toString( 'utf8' ).replace( /\n/g, '' );
	console.log( '%s', line );
	if ( line.indexOf( 'Started map' ) != -1 && !rcon ) {
		rcon = createConnection( 27015, ip );
		rcon.setNoDelay();
		rcon.setKeepAlive( true );
		rconSend( 3, tf2_rcon );
		tf2state = 'online';
		sendTF2State( socket );
	}
} );
log.bind( 57015, '127.0.0.2' ); // 127.0.0.1 doesn't work for some odd reason

// Randomize RCON password
tf2_rcon = '';
for ( var i = 0; i < 64; i++ ) {
	tf2_rcon += rcon_chars[Math.floor( Math.random() * rcon_chars.length )];
}

tf2 = spawn( '../tfds/orangebox/srcds_run', [/*'-autoupdate',*/ '-steambin', '../../steam', '-maxplayers', '20', '+map', map, '+rcon_password', tf2_rcon, '+sv_logfile', '0', '+log_verbose_enable', '1', '+log_verbose_interval', '1', '+log', 'on', '+logaddress_add', '127.0.0.2:57015'] );
tf2state = 'starting';

//rconSend( 2, 'pubcomp_add_steamid STEAM_0:0:26649930' );

function sendTF2State( client ) {
	client.broadcast({ tf: tf2state });
}

var server = http.createServer( function( req, res ) {
	fs.readFile( 'pubcomp.html', function( err, data ) {
		if ( err ) { res.end(); return; }
		res.writeHead( 200, {'Content-Type': 'text/html'} );
		res.write( data, 'utf8' );
		res.end();
	} );
} );
server.listen( 27014 );

var socket = io.listen( server );
socket.on( 'connection', function( client ) {
	socket.broadcast({ 'numOnline': Object.keys( socket.clients ).length });
	sendTF2State( client );

	client.on('message', function(message){
		if ( typeof message != 'object' ) {
			return;
		}
		if ( 'action' in message ) {
			switch ( message.action ) {
				case 'tf':
					sendTF2State( client );
					break;
				case 'join_match':
					if ( /^STEAM_\d:\d:\d+$/.test( message.steamid ) ) {
						rconSend( 2, 'pubcomp_add_steamid ' + message.steamid );
						setTimeout(function(){
							client.broadcast({ 'joinserver': ip + ':27015' });
						}, 100 );
					}
					break;
			}
		}
	});

	client.on('disconnect', function() {
		socket.broadcast({ 'numOnline': Object.keys( socket.clients ).length });
	});
} );
setInterval( function() {
	socket.broadcast({ 'numOnline': Object.keys( socket.clients ).length });
	sendTF2State( socket );
}, 5000 );
