var dgram = require('dgram');

// var logparser = require('tf2logparser').TF2LogParser.create();
// function parseLine( line ){ logParser.parseLine( line ); }
// require('logsocket').create( parseLine ).bind( 57015, '127.0.0.2' );
exports.create = function( callback ) {
	if ( typeof callback != 'function' )
		callback = console.log;

	var log = dgram.createSocket( 'udp4' );
	log.on( 'message', function( msg, rinfo ) {
		if ( msg.slice( 0, 7 ).toString( 'base64' ) != '/////1I=' ) {
			// Not a log message
			return;
		}
		var line = msg.slice( 7 ).toString( 'utf8' ).replace( /\n/g, '' );
		callback( line );
	} );
	return log;
}