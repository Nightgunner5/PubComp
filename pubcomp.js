var http = require( 'http' ),
	io = require( 'socket.io'),
	fs = require( 'fs' ),
	child_process = require( 'child_process' ),
	spawn = child_process.spawn,
	exec = child_process.exec,
	dgram = require( 'dgram' ),
	bignumber = require( 'bignumber' ).BigInteger,
	logparser = require( 'tf2logparser' ).TF2LogParser,
	tf2 = null,
	tf2_rcon = '',
	rcon_chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'.split( '' ),
	rcon = null,
	tf2state = 'unknown',
	map = 'cp_granary',
	config = require( './config' ),
	wp_auth = require( 'wordpress-auth' ).create(
				config.wpauth.wpurl, config.wpauth.logged_in_key, config.wpauth.logged_in_salt,
				config.wpauth.mysql_host, config.wpauth.mysql_user, config.wpauth.mysql_pass,
				config.wpauth.mysql_db, config.wpauth.wp_table_prefix ),
	updatebuffer = '';

process.chdir( __dirname );

var log = logparser.create(), filelog = fs.createWriteStream( 'debug.log' );
require('./logsocket').create( function( line ) {
	filelog.write( line + '\n', 'utf8' );
	log.parseLine( line );
	if ( tf2state == 'updating' || tf2state == 'unknown' ) {
		require( 'util' ).log( 'TF2 state change: ' + tf2state + ' -> starting' );
		tf2state = 'starting';
	}
	if ( line.indexOf( 'Started map' ) != -1 && !rcon ) {
		rcon = require('./rcon').create( 27015, '127.0.0.1' )
				.password( tf2_rcon )
				.send( 'pubcomp_add_steamid ""' )
				.send( 'sv_downloadurl "http://' + config.SITEURL + '/tf/"' )
				.send( 'mp_tournament 1; mp_tournament_allow_non_admin_restart 0' );
		require( 'util' ).log( 'TF2 state change: ' + tf2state + ' -> almost' );
		tf2state = 'almost';
		sendTF2State( socket );
	}
	if ( line.indexOf( 'rcon from "' ) != -1 && tf2state != 'online' ) {
		require( 'util' ).log( 'TF2 state change: ' + tf2state + ' -> online' );
		tf2state = 'online';
		sendTF2State( socket );
	}
} ).bind( 57015, '127.0.0.2' ); // 127.0.0.1 doesn't work for some odd reason

// Randomize RCON password
tf2_rcon = '';
for ( var i = 0; i < 64; i++ ) {
	tf2_rcon += rcon_chars[Math.floor( Math.random() * rcon_chars.length )];
}

tf2 = spawn( '../tfds/orangebox/srcds_run', [process.argv.indexOf( '--noupdate' ) == -1 ? '-autoupdate' : '', '-steambin', '../../steam', '-maxplayers', '20', '+tv_enable', '1', '+map', map, '+rcon_password', tf2_rcon, '+sv_logfile', '0', '+log_verbose_enable', '1', '+log_verbose_interval', '1', '+log', 'on', '+logaddress_add', '127.0.0.2:57015', '+sv_allowdownload', '1', '+sv_allowupload', '1', '+hostname', 'PubComp ' + config.SERVERNAME] );
require( 'util' ).log( 'TF2 state change: ' + tf2state + ' -> updating' );
tf2state = 'updating';
tf2.stdout.setEncoding( 'utf8' );
tf2.stdout.on( 'data', function( data ) {
	if ( tf2state == 'updating' ) {
		updatebuffer += data;
		require( 'util' ).log( 'TF2 update status: ' + data.trim() );
	} else {
		updatebuffer = '';
	}
} );

process.on( 'exit', function() {
	try {
		tf2.kill();
	} catch ( ex ) {}
} );

function sendTF2State( client ) {
	client.send ? client.send({ tf: tf2state }) : client.broadcast({ tf: tf2state });
}

var server = http.createServer( function( req, res ) {
	if ( req.url == '/pubcomp' ) {
		fs.readFile( 'pubcomp.html', function( err, data ) {
			if ( err ) { res.writeHead( 404 ); res.end(); return; }
			res.writeHead( 200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' } );
			res.write( data.toString( 'utf8' ).replace( /\{WPCOOKIE\}/g, function() {
				var data = [];
				if ( req.headers.cookie )
					req.headers.cookie.split( ';' ).forEach( function( cookie ) {
						if ( cookie.split( '=' )[0].trim() == wp_auth.cookiename )
							data = cookie.split( '=' )[1].trim().split( '%7C' );
					} );
				if ( data.length == 3 )
					return JSON.stringify( data.join( '%7C' ) );
				return '""';
			} ).replace( /\{([A-Z]+?)\}/g, function( a, b ) {
				if ( b == 'WPLOGIN' )
					return config.wpauth.wpurl + '/wp-login.php?redirect_to=' + escape( config.wpauth.wpurl + '/pubcomp' );
				if ( b in config )
					return config[b];
				return a;
			} ), 'utf8' );
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
server.listen( config.SOCKETPORT );

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
				wp_auth.checkAuth( { headers: { cookie: wp_auth.cookiename + '=' + message.cookie } } ).on( 'auth', function( auth_is_valid, user_id ) {
					if ( !auth_is_valid ) {
						client.send({ message: 'Please log in again. Your session has expired.' });
						return;
					}

					wp_auth.getUserMeta( user_id, 'pubcomp_steam_id', function( data ) {
						if ( typeof data == 'string' ) {
							var id64 = new bignumber( data );
							data = 'STEAM_0:' + id64.mod( new bignumber( '2' ) ).toString() + ':' + id64.subtract( new bignumber( '76561197960265728' ) ).shiftRight( 1 ).toString();
							rcon.send( 'pubcomp_add_steamid ' + data );
							client.send({ 'joinserver': config.SERVERIP + ':27015' });
							return;
						}
					} );
				} );
				break;
		}
	});

	client.on('disconnect', function() {
		socket.broadcast({ 'numOnline': Object.keys( socket.clients ).length });
	});
} );
function filterLog( log, tf2state ) {
	if ( tf2state == 'starting' ) return {};
	if ( tf2state == 'almost' ) return { mapName: log.mapName };
	var filtered = JSON.parse( JSON.stringify( log ) );
	filtered.events = filtered.events.filter( function( event ) {
		return +event.timestamp >= new Date - 5000;
	} );
	filtered.players = filtered.players.filter( function( player ) { return player.online; } );
	return filtered;
}
var current_update_file = null, prev_update_file = null, max_update_lag = 360, steam_pid = 0, file_lag = 0;
setInterval( function getCurrentUpdateFile() {
	if ( tf2state == 'updating' ) {
		if ( !steam_pid ) {
			exec( 'ps -C steam -o pid=', function( error, stdout, stderr ) {
				steam_pid = parseInt( stdout.trim() );
				if ( isNaN( steam_pid ) )
					steam_pid = 0;
				else
					getCurrentUpdateFile();
			} );
			return;
		}

		exec( 'ls -l /proc/' + steam_pid + '/fd', function( error, stdout, stderr ) {
			if ( error || !stdout || stdout.lastIndexOf( '/tfds/' ) == -1 ) {
				steam_pid = 0;
				current_update_file = null;
				return;
			}
			var filename = stdout.substr( stdout.lastIndexOf( '/tfds/' ) + 6 );
			if ( filename.indexOf( '\n' ) != -1 )
				filename = filename.substr( 0, filename.indexOf( '\n' ) );
			if ( filename == ' 0' )
				filename = null;
			current_update_file = filename;
			if ( filename && prev_update_file == current_update_file ) {
				file_lag++;
			} else {
				file_lag = 0;
			}
			prev_update_file = current_update_file;
			if ( file_lag > max_update_lag ) {
				require( 'util' ).log( 'Steam process seems to be hanging; stuck on ' + filename + ' for over 30 minutes. Killing update...' );
				updatebuffer += 'PubComp: Steam process seems to be hanging; stuck on ' + filename + ' for over 30 minutes.\nPubComp: Killing update...\n';
				exec( 'kill ' + steam_pid );
				prev_update_file = null;
				current_update_file = null;
			}
		} );
	}
}, 1000 );
setInterval( function() {
	socket.broadcast( {
		'numOnline': Object.keys( socket.clients ).length,
		'tf': tf2state,
		'state': tf2state == 'updating' ? { update: updatebuffer, file: current_update_file, lag: file_lag * 5 } : filterLog( log.getLog(), tf2state )
	} );
}, 1000 );
