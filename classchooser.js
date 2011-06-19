// For the first five games, a player is considered a newbie and is given first choice no matter what.
exports.newbie = 5;

exports.gametypes = {
	'6v6': {
		scout: 2,
		pocketsoldier: 1,
		roamingsoldier: 1,
		demoman: 1,
		medic: 1
	},
	'highlander': {
		scout: 1,
		soldier: 1,
		pyro: 1,
		demoman: 1,
		engineer: 1,
		heavyweapons: 1,
		medic: 1,
		sniper: 1,
		spy: 1
	}
};

exports.firstChoice = {
	'6v6': {
		scout: 0,
		pocketsoldier: 0,
		roamingsoldier: 0,
		demoman: 0,
		medic: 0
	},
	'highlander': {
		scout: 0,
		soldier: 0,
		pyro: 0,
		demoman: 0,
		engineer: 0,
		heavyweapons: 0,
		medic: 0,
		sniper: 0,
		spy: 0
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

// players in the format [ { player: 'name', choices: ['class', 'class', 'class', ...], playtime: { class: matches, class: matches } }, ... ]
exports.chooseClasses = function( players, mode ) {
	var needed = exports.gametypes[mode],
		have = {},
		given = {};
	players = Array.prototype.shuffle.call( players ).map( function( player ) {
		player.games = 0;
		for ( var cls in player.playtime )
			player.games += player.playtime[cls];
		return player;
	} );

	for ( var cls in needed ) {
		have[cls] = 0;
	}

	// While there are players with fewer than N games played:
	// If their first choice is available, they get it.
	players.sort( function( a, b ) {
		return b.games - a.games;
	} ).forEach( function( player ) {
		if ( player.games < exports.newbie ) {
			if ( needed[player.choices[0]] && needed[player.choices[0]] < have[player.choices[0]] ) {
				given[player.player] = player.choices[0];
				have[player.choices[0]]++;
				return;
			}
		}
	} );

	var fc = {};
	// While there are positions with as many or more openings than first choices, assign first choices to these openings.
	players.forEach( function( player ) {
		if ( !( player.player in given ) ) {
			if ( player.choices[0] in fc )
				fc[player.choices[0]]++;
			else
				fc[player.choices[0]] = 1;
		}
	} );

	for ( var cls in fc ) {
		if ( cls in needed && fc[cls] <= ( needed[cls] - have[cls] ) ) {
			players.forEach( function( player ) {
				if ( !( player.player in given ) && player.choices[0] == cls ) {
					have[cls]++;
					given[player.player] = cls;
				}
			} );
		}
	}

	// If any new players didn’t get their first choices, let them pick in ascending order of games played.
	players.sort( function( a, b ) {
		return b.games - a.games;
	} ).forEach( function( player ) {
		if ( player.games < exports.newbie ) {
			for ( var i = 0; i < player.choices.length; i++ ) {
				if ( need[player.choices[i]] && need[player.choices[i]] < have[player.choices[i]] ) {
					given[player.player] = player.choices[i];
					have[player.choices[i]]++;
					return;
				}
			}
		}
	} );

	// Return 0 if a / b would be division by zero; return a / b otherwise.
	function customDiv( a, b ) { return b ? a / b : 0; }

	// While players to pick:
	// Let max(players, key=tuple(min(played %, required %) for role in leastWantedRoles)) pick.
	var leastWantedRoles = {}, totalRoles = 0, totalFirstChoices = 0;
	for ( var cls in needed ) {
		totalRoles += needed[cls];
		totalFirstChoices += exports.firstChoice[mode][cls];
	}
	for ( var cls in needed ) {
		leastWantedRoles[cls] = customDiv( customDiv( exports.firstChoice[mode][cls], totalFirstChoices ), customDiv( needed[cls], totalRoles ) );
	}
	var playerScores = [];
	players.forEach( function( player ) {
		var score = 0;
		for ( var role in leastWantedRoles ) {
			score += customDiv( Math.min( customDiv( needed[role], totalRoles ), customDiv( player.playtime[role], player.games ) ), leastWantedRoles[role] );
		}
		playerScores.push( { player: player, score: score } );
	} );

	playerScores.sort( function( a, b ){
		return a.score - b.score;
	} ).forEach( function( score ) {
		var player = score.player;
		for ( var i = 0; i < player.choices.length; i++ ) {
			if ( need[player.choices[i]] && need[player.choices[i]] < have[player.choices[i]] ) {
				given[player.player] = player.choices[i];
				have[player.choices[i]]++;
				return;
			}
		}
	} );

	// Everyone who hasn't been given a role gets one that is left over.
	Array.prototype.shuffle.call( players ).forEach( function( player ) {
		if ( player.player in given )
			return;
		for ( var role in needed ) {
			if ( needed[role] > have[role] ) {
				given[player.player] = role;
				have[role]++;
				return;
			}
		}
	} );

	return given;
};
