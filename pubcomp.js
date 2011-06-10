var http = require('http'), 
	spawn = require('child_process').spawn,
	parse = require('url').parse,
	tf2 = null,
	buffer = '';

function spawnTF2( map ) {
	tf2 = spawn( '../tfds/tf2/orangebox/srcds', ['-console', '+map', map, '-game', 'tf'], {cwd: '../tfds/tf2/orangebox'} );
	tf2.on( 'exit', function( code ) {
		tf2 = null;
	} );
	tf2.stdout.setEncoding( 'utf8' );
	tf2.stdout.on( 'data', function( data ) {
		buffer += data;
		console.log(data);
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
	buffer = '';
} ).listen( 27014, '0.0.0.0' );
