var dgram = require('dgram');

var log = dgram.createSocket( 'udp4' );
log.on( 'message', function( msg, rinfo ) {
	if ( rinfo.address != '127.0.0.2' || rinfo.port != 27015 )
		return;
	if ( msg.slice( 0, 7 ).toString( 'base64' ) != '/////1JMIA==' )
		console.log( '???: %s', msg );
	console.log( '%s', msg.slice( 7 ).toString( 'utf8' ).replace( /\n/g, '' ) );
} );
log.bind( 57015, '127.0.0.2' ); // 127.0.0.1 doesn't work for some odd reason
process.stdin.resume();

