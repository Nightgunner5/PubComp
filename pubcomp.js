var http = require('http'),
	io = require('socket.io'),
	fs = require('fs'),
	spawn = require('child_process').spawn,
	dgram = require("dgram"),
	bignumber = require('bignumber').BigInteger,
	tf2 = null,
	tf2_rcon = '',
	rcon_chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'.split( '' ),
	rcon = null,
	ip = 'nightgunner5.is-a-geek.net',
	tf2state = 'unknown',
	map = 'mge_training_v7';

require('./logsocket').create(function(line) {
	console.log( '%s', line );
	if ( line.indexOf( 'Started map' ) != -1 && !rcon ) {
		rcon = require('./rcon').create( 27015, '127.0.0.1' ).password( tf2_rcon ).send( 'pubcomp_add_steamid ""' ).send( 'sv_downloadurl "http://' + ip + ':27014/tf/"' );
		tf2state = 'almost';
		sendTF2State( socket );
	}
	if ( line.indexOf( 'rcon from "' ) != -1 && tf2state != 'online' ) {
		tf2state = 'online';
		sendTF2State( socket );
	}
} ).bind( 57015, '127.0.0.2' ); // 127.0.0.1 doesn't work for some odd reason

// Randomize RCON password
tf2_rcon = '';
for ( var i = 0; i < 64; i++ ) {
	tf2_rcon += rcon_chars[Math.floor( Math.random() * rcon_chars.length )];
}

tf2 = spawn( '../tfds/orangebox/srcds_run', [/*'-autoupdate',*/ '-steambin', '../../steam', '-maxplayers', '20', '+map', map, '+rcon_password', tf2_rcon, '+sv_logfile', '0', '+log_verbose_enable', '1', '+log_verbose_interval', '1', '+log', 'on', '+logaddress_add', '127.0.0.2:57015', '+tf_bot_quota', '12', '+tf_bot_quota_mode', 'fill', '+sv_allowdownload', '1', '+sv_allowupload', '1'] );
tf2state = 'starting';

//rconSend( 2, 'pubcomp_add_steamid STEAM_0:0:26649930' );

function sendTF2State( client ) {
	client.broadcast({ tf: tf2state });
}

var server = http.createServer( function( req, res ) {
	if ( req.url == '/' ) {
		fs.readFile( 'pubcomp.html', function( err, data ) {
			if ( err ) { res.writeHead( 404 ); res.end(); return; }
			res.writeHead( 200, {'Content-Type': 'text/html'} );
			res.write( data, 'utf8' );
			res.end();
		} );
	} else if ( /\/tf\/.*\.bz2$/.test( req.url ) && req.url.indexOf( '..' ) == -1 ) {
		var stream = fs.createReadStream( '../tfds/orangebox' + req.url ), len = fs.statSync( '../tfds/orangebox' + req.url ).size;
		stream.on( 'error', function( exception ) {
			res.writeHead( 404 );
			res.end();
			console.log( exception );
		} );
		var wroteHead = false;
		stream.on( 'data', function( data ) {
			if ( !wroteHead ) {
				res.writeHead( 200, {
					'Content-Type': 'application/x-bzip2',
					'Content-Length': len,
					'Keep-Alive': 'timeout=5, max=1',
					'Connection': 'Keep-Alive'
				} );
				wroteHead = true;
			}
			res.write( data );
		} );
		stream.on( 'end', function() {
			res.end();
		} );
	} else {
		res.writeHead( 404 );
		res.end();
	}
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
		switch ( message.action ) {
			case 'tf':
				sendTF2State( client );
				break;
			case 'join_match':
				if ( !rcon )
					break;
				client.broadcast({ 'joinserver': ip + ':27015' });
				var path;
				if ( /^STEAM_\d:\d:\d+$/.test( message.steamid ) ) {
					rcon.send( 'pubcomp_add_steamid ' + message.steamid );
					setTimeout(function(){
						client.broadcast({ 'joinserver': ip + ':27015' });
					}, 100 );
				} else if ( ( path = /^http:\/\/(?:www\.)?steamcommunity\.com(\/(profile|id)\/[^\/]+)$/.exec( message.steamid ) ) && path.length ) {
					path = path[1];
					http.get( { host: 'steamcommunity.com', port: 80, path: path + '?xml=1' }, function( res ) {
						// Once we find the person's steam ID, don't add all their friends to the permission list as well.
						var found = false;
						res.setEncoding( 'utf8' );
						res.on( 'data', function( chunk ) {
							// Wait for it...
							if ( found )
								return;
							// I typed that without noticing what I had typed.
							found = true;
							var ID64 = /<steamID64>(\d+)<\/steamID64>/.exec( chunk );
							if ( ID64 && ID64.length ) {
								ID64 = new bignumber( ID64[1] );
								var steamID = 'STEAM_0:' + ID64.mod( new bignumber( '2' ) ) + ':' + ( ID64.subtract( new bignumber( '76561197960265728' ) ).shiftRight( 1 ) );
								rcon.send( 'pubcomp_add_steamid ' + steamID );
								client.broadcast({ 'joinserver': ip + ':27015' });
							}
						} );
					} );
				}
				break;
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
