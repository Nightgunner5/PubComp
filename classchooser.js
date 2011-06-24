// For the first five games, a player is considered a newbie and is given first choice no matter what.
exports.newbie = 5;

exports.debug = false;

var config = exports.config = JSON.parse( require( 'fs' ).readFileSync( __dirname + '/config.json', 'utf8' ) );

exports.getConfig = function() {
	return JSON.parse( JSON.stringify( config ) );
};

var globalFirstChoice = {};
Object.keys( config.positions ).forEach( function( position ) {
	globalFirstChoice[position] = 0;
} );

exports.setGlobalFirstChoices = function( globalFirstChoices ) {
	for ( var cls in globalFirstChoices ) {
		if ( !( cls in globalFirstChoice ) )
			throw new Error( 'Class ' + cls + ' not found in config file' );

		globalFirstChoice[cls] = globalFirstChoices[cls];
	}
};

if ( !Array.prototype.shuffle ) {
    Array.prototype.shuffle = function() {
        var result = this.slice( 0 );

        for ( var i = 0; i < result.length; i++ ) {
            var j = Math.floor( Math.random() * result.length );
            var contents = result[i];
            result[i] = result[j];
            result[j] = contents;
        }

        return result;
    };
}

// TODO: Add a method of preferring two players to be on the same team
// players in the format [ { player: 'name', choices: ['role', 'role', 'role', ...], playtime: { role: matches, role: matches } }, ... ]
// return value in the format [ { player: 'name', team: 'team', role: 'role' }, ... ]
exports.chooseClasses = function( players, mode ) {
	if ( !( mode in config.gameTypes ) ) {
		throw new Error( 'Unknown game type: ' + mode );
	}

	players = Array.prototype.shuffle.call( players ).map( function( player ) {
		player.games = 0;
		for ( var cls in player.playtime )
			player.games += player.playtime[cls];
		return player;
	} );

	var cfg = config.gameTypes[mode],
		neededRed = {},
		neededBlu = {},
		given = [];

	if ( players.length != cfg.players.length * 2 ) {
		throw new Error( 'Have ' + players.length + ' players but need exactly ' + ( cfg.players.length * 2 ) + ' for ' + cfg.name + '.' );
	}

	cfg.players.forEach( function( position ) {
		neededRed[position] = neededRed[position] ? neededRed[position] + 1 : 1;
		neededBlu[position] = neededBlu[position] ? neededBlu[position] + 1 : 1;
	} );

	// If there are players with fewer than N games played, give them their first choice (if available)
	players.sort( function( a, b ) {
		return b.games - a.games;
	} ).forEach( function( player ) {
		if ( player.games < exports.newbie ) {
			if ( neededBlu[player.choices[0]] ) {
				given.push( { player: player.player, team: 'Blue', role: player.choices[0] } );
				neededBlu[player.choices[0]]--;
				if ( exports.debug )
					console.log( '(1) Giving player %s role %s on team %s', given[given.length - 1].player, given[given.length - 1].role, given[given.length - 1].team );
				players.splice( players.indexOf( player ), 1 );
				return;
			}
			if ( neededRed[player.choices[0]] ) {
				given.push( { player: player.player, team: 'Red', role: player.choices[0] } );
				neededRed[player.choices[0]]--;
				if ( exports.debug )
					console.log( '(1) Giving player %s role %s on team %s', given[given.length - 1].player, given[given.length - 1].role, given[given.length - 1].team );
				players.splice( players.indexOf( player ), 1 );
				return;
			}
		}
	} );

	// While there are positions with as many or more openings than first choices, assign first choices to these openings.
	var firstChoices = {};
	players.forEach( function( player ) {
		if ( !( player.choices[0] in firstChoices ) )
			firstChoices[player.choices[0]] = [player];
		else
			firstChoices[player.choices[0]].push( player );
	} );

	for ( var role in firstChoices ) {
		if ( role in neededBlu && neededBlu[role] + neededRed[role] >= firstChoices[role].length ) {
			firstChoices[role].forEach( function( player ) {
				var team;
				if ( neededBlu[role] ) {
					neededBlu[role]--;
					team = 'Blue';
				} else {
					neededRed[role]--;
					team = 'Red';
				}
				given.push( { player: player.player, team: team, role: role } );
				if ( exports.debug )
					console.log( '(2) Giving player %s role %s on team %s', given[given.length - 1].player, given[given.length - 1].role, given[given.length - 1].team );
				players.splice( players.indexOf( player ), 1 );
			} );
		}
	}

	function choosePlayerPosition( player, step ) {
		var done = false;
		player.choices.forEach( function( role ) {
			if ( done ) return;
			if ( neededBlu[role] ) {
				done = true;
				neededBlu[role]--;
				given.push( { player: player.player, team: 'Blue', role: role } );
				return;
			}
			if ( neededRed[role] ) {
				done = true;
				neededRed[role]--;
				given.push( { player: player.player, team: 'Red', role: role } );
				return;
			}
		} );

		if ( !done ) {
			for ( var role in neededBlu ) {
				if ( neededBlu[role] ) {
					done = true;
					neededBlu[role]--;
					given.push( { player: player.player, team: 'Blue', role: role } );
					break;
				}
			}
		}
		if ( !done ) {
			for ( var role in neededRed ) {
				if ( neededRed[role] ) {
					done = true;
					neededRed[role]--;
					given.push( { player: player.player, team: 'Red', role: role } );
					break;
				}
			}
		}

		if ( exports.debug )
			console.log( '(%d) Giving player %s role %s on team %s', step, given[given.length - 1].player, given[given.length - 1].role, given[given.length - 1].team );
		players.splice( players.indexOf( player ), 1 );
	}

	// If any new players didn’t get their first choices, let them pick in ascending order of games played.
	players.sort( function( a, b ) {
		return b.games - a.games;
	} ).forEach( function( player ) {
		if ( player.games < exports.newbie ) {
			choosePlayerPosition( player, 3 );
		}
	} );

	// Return 0 if a / b would be division by zero; return a / b otherwise.
	function customDiv( a, b ) { return b ? ( a ? a : 0 ) / b : 0; }

	var leastWantedRoles = Object.keys( globalFirstChoice ).sort( function( a, b ) {
		return globalFirstChoice[b] - globalFirstChoice[a];
	} );

	// While players to pick:
	// Let max(players, key=tuple(min(played %, required %) for role in leastWantedRoles)) pick.
	players = players.sort( function( a, b ) {
		for ( var i = 0; i < leastWantedRoles.length; i++ ) {
			var role = leastWantedRoles[i],
				as = Math.min( customDiv( a.playtime[role], a.games ), customDiv( cfg.players.filter( function( r ) { return r == role; } ).length, cfg.players.length ) ),
				bs = Math.min( customDiv( b.playtime[role], b.games ), customDiv( cfg.players.filter( function( r ) { return r == role; } ).length, cfg.players.length ) );
			if ( as > bs )
				return -1;
			if ( as < bs )
				return 1;
		}
		return 0;
	} );
	while ( players[0] ) {
		choosePlayerPosition( players[0], 4 );
	}

	return given;
};
