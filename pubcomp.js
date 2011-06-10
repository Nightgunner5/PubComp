var http = require('http'), 
	spawn = require('child_process').spawn,
	socket = require('net').Socket,
	parse = require('url').parse,
	tf2 = null,
	tf2_rcon = '',
	rcon_chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'.split( '' ),
	rcon = null,
	buffer = '',
	ip = '127.0.0.1';

function rconInt( num ) {
	return String.fromCharCode( num % 256, ( num >> 8 ) % 256, ( num >> 16 ) % 256, ( num >> 24 ) % 256 );
}

// Status 3 is normal, status 2 means password.
function rconSend( status, command ) {
	var packet = '\0\0\0\0' + rconInt( status ) + command + '\0\0';
	rcon.write( rconInt( packet.length ) + packet );
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

	// Start TF2 server
	tf2 = spawn( './srcds', ['-autoupdate', '-nohltv', '-maxplayers', '20', '+rcon_password', tf2_rcon, '+map', map, '-game', 'tf'], {cwd: '../tfds/orangebox'} );
	tf2.on( 'exit', function( code ) {
		tf2 = null;
	} );
	tf2.stdout.setEncoding( 'utf8' );
	tf2.stdout.on( 'data', function( data ) {
		buffer += data;
		console.log(data);
	} );
	tf2.stderr.setEncoding( 'utf8' );
	tf2.stderr.on( 'data', function( data ) {
		buffer += data;
		console.error(data);
	} );
	rcon = new socket();
	rcon.connect( 27015 );
	rcon.setNoDelay();
	rcon.setKeepAlive( true );
	rconSend( 2, tf2_rcon );
}

http.createServer( function( req, res ) {
	var query = parse(req.url, true).query;
	if ( query && 'start' in query && !tf2 ) {
		spawnTF2( query.start );
		res.writeHead( 302, {'Location': '/'} );
		res.end();
		return;
	}
	if ( query && 'join' in query && tf2 ) {
		if ( !/^STEAM_\d:\d:\d+$/.test( query.join ) ) {
			res.writeHead( 302, {'Location': '/'} );
			res.end();
			return;
		}

		rconSend( 3, 'pubcomp_add_steamid ' + query.join );
		res.writeHead( 302, {'Location': 'steam://connect/' + ip} );
		res.end();
		return;
	}
	
	res.writeHead( 200, {'Content-Type': 'text/html'} );
	if ( tf2 ) {
		res.end( '<pre>TF2 is running. <a href="?join=STEAM_0:0:26649930">Join the game!</a>\n\n' + buffer + '</pre>' );
	} else {
		res.end( '<pre>TF2 is NOT running. <a href="?start=mge">Start it.</a>\n\n' + buffer + '</pre>' );
	}
} ).listen( 27014, '0.0.0.0' );
