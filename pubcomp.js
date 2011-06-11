var http = require('http'),
	io = require('socket.io'),
	fs = require('fs'),
	spawn = require('child_process').spawn,
	Sock = require('net').Socket,
	parse = require('url').parse,
	tf2 = null,
	tf2_rcon = '',
	rcon_chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'.split( '' ),
	rcon = null,
	buffer = '',
	ip = 'nightgunner5.is-a-geek.net',
	rconbuffer = '';

function rconInt( num ) {
	return String.fromCharCode( num % 256, ( num >> 8 ) % 256, ( num >> 16 ) % 256, ( num >> 24 ) % 256 );
}

// Status 3 is normal, status 2 means password.
function rconSend( status, command ) {
	var packet = '\0\0\0\0' + rconInt( status ) + command + '\0\0';
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

function spawnTF2( mode ) {
	if ( ['mge'].indexOf( mode ) == -1 || tf2 )
		return;

	// Randomize RCON password
	tf2_rcon = '';
	for ( var i = 0; i < 64; i++ ) {
		tf2_rcon += rcon_chars[Math.floor( Math.random() * rcon_chars.length )];
	}

	var map = '';
	switch ( mode ) {
		case 'mge':
			map = 'mge_training_v7';
			break;
	}

	buffer = '';

	// Start TF2 server
	tf2 = spawn( './srcds_run', ['-autoupdate', '-nohltv', '-maxplayers', '20', '-game', 'tf', '+rcon_password', tf2_rcon, '+map', map], {cwd: '../tfds/orangebox'} );
	tf2.on( 'exit', function( code ) {
		tf2 = null;
		try { rcon.end(); } catch ( ex ) {}
		rcon = null;
		clients.broadcast({ 'tf': 'offline' });
	} );
	tf2.stdout.setEncoding( 'utf8' );
	tf2.stdout.on( 'data', function( data ) {
		buffer += data;
		console.log(data);
		if ( buffer.indexOf( 'Executing dedicated server config file' ) != -1 && !rcon ) {
			rcon = new Sock();
			rcon.connect( 27015 );
			rcon.setNoDelay();
			rcon.setKeepAlive( true );
			rconSend( 2, tf2_rcon );
			clients.broadcast({ 'tf': 'online' });
		}
	} );
	tf2.stderr.setEncoding( 'utf8' );
	tf2.stderr.on( 'data', function( data ) {
		buffer += data;
		console.error(data);
	} );
	rcon = null;
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

var socket = io.listen( server ), clients = [];
clients.broadcast = function( msg ){
	for ( var i = 0; i < clients.length; i++ ) {
		clients[i].broadcast( msg );
	}
}
socket.on( 'connection', function( client ) {
	clients.push( client );

	clients.broadcast({ 'numOnline': clients.length });
	client.broadcast({ 'tf': tf2 ? ( rcon ? 'online' : 'starting' ) : 'offline' });

	client.on('message', function(message){
		if ( typeof message != 'object' ) {
			return;
		}
		if ( 'action' in message ) {
			switch ( message.action ) {
				case 'tf':
					client.broadcast({ 'tf': tf2 ? ( rcon ? 'online' : 'starting' ) : 'offline' });
					break;
				case 'create_match':
					spawnTF2( 'mge' );
					clients.broadcast({ 'tf': 'starting' });
					break;
				case 'join_match':
					if ( /^STEAM_\d:\d:\d+$/.test( message.steamid ) ) {
						rconSend( 3, 'pubcomp_add_steamid ' + message.steamid );
						client.broadcast({ join: ip + ':27015' });
					}
					break;
			}
		}
	});

	client.on('disconnect', function(){
		clients.splice(clients.indexOf(client), 1);
		clients.broadcast({ 'numOnline': clients.length });
	});
} );
