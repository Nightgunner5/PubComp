var createConnection = require('net').createConnection,
	util = require(process.binding('natives').util ? 'util' : 'sys');

function rconInt( num ) {
	return String.fromCharCode( num % 256, ( num >> 8 ) % 256, ( num >> 16 ) % 256, ( num >> 24 ) % 256 );
}

function rconInt2( buf ) {
	return buf.charCodeAt( 0 ) + ( buf.charCodeAt( 1 ) << 8 ) + ( buf.charCodeAt( 2 ) << 16 ) + ( buf.charCodeAt( 3 ) << 24 );
}

// Status 2 is normal, status 3 means password.
function rconSend( rcon, status, command ) {
	var packet = rconInt( 0 ) + rconInt( status ) + command + '\0\0';
	rcon.write( rconInt( packet.length ) + packet );
}

function RCON( port, ip ) {
	this.connection = createConnection( port, ip );
	//this.connection.setNoDelay();
	//this.connection.setKeepAlive( true );
	this.connected = false;

	var self = this;
	this.connection.on( 'connect', function(){ self.connected = true; self.emit( 'connect' ); } );
	this.connection.on( 'data', function( data ){ self.emit( 'data', data ); } );
	this.connection.on( 'end', function(){ self.emit( 'end' ); } );
	this.connection.on( 'timeout', function(){ self.emit( 'timeout' ); } );
	this.connection.on( 'drain', function(){ self.emit( 'drain' ); } );
	this.connection.on( 'error', function( exception ){ self.emit( 'error', exception ); } );
	this.connection.on( 'close', function( had_error ){ self.emit( 'close', had_error ); } );

	this.connection.on( 'data', function( data ) {
		if ( data.length >= 18 )
			self.emit( 'response', data.slice( 16, data.length - 2 ).toString( 'utf8' ) );
	} );
}
util.inherits(RCON, process.EventEmitter);

RCON.prototype.password = function( passwd ) {
	if ( this.connected ) {
		//console.log( 'RCON(3) SEND: %s', passwd );
		rconSend( this.connection, 3, passwd );
	} else {
		//console.log( 'RCON(3) DELAYED: %s', passwd );
		this.on( 'connect', function() {
			this.password( passwd );
		} );
	}
	return this;
};

RCON.prototype.send = function( command ) {
	if ( this.connected ) {
		//console.log( 'RCON(2) SEND: %s', command );
		rconSend( this.connection, 2, command );
	} else {
		//console.log( 'RCON(2) DELAYED: %s', command );
		this.on( 'connect', function() {
			this.send( command );
		} );
	}
	return this;
};

exports.create = function( port, ip ){
	return new RCON( port, ip );
};
