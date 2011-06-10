var http = require('http'), 
	spawn = require('child_process').spawn,
	parse = require('url').parse,
	tf2 = null,
	tf2_rcon = '',
	rcon_chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'.split( '' )
	buffer = '';

function spawnTF2( map ) {
	// Randomize RCON password
	tf2_rcon = '';
	for ( var i = 0; i < 64; i++ ) {
		tf2_rcon += rcon_chars[Math.floor( Math.random() * rcon_chars.length )];
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
}

http.createServer( function( req, res ) {
	var query = parse(req.url, true).query;
	if ( query && 'start' in query && !tf2 ) {
		spawnTF2( query.start );
	}
	
	res.writeHead( 200, {'Content-Type': 'text/html'} );
	if ( tf2 ) {
		res.end( '<pre>TF2 is running.\n\n' + buffer + '</pre>' );
	} else {
		res.end( '<pre>TF2 is NOT running. <a href="?start=cp_gravelpit">Start it.</a>\n\n' + buffer + '</pre>' );
	}
} ).listen( 27014, '0.0.0.0' );
