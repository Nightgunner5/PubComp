var classchooser = require( './classchooser' );

classchooser.setGlobalFirstChoices( {
	utility: 10000,
	pocket:   1000,
	roamer:   9999,
	scout:    8888,
	soldier: 12000,
	pyro:     7890,
	demo:     9001,
	heavy:    8900,
	engineer: 3000,
	medic:       2,
	sniper:    900,
	spy:      4000
} );

var input = [
	{ player: 'GabeN', choices: ['spy', 'demoman', 'roamer', 'pyro'], playtime: { spy: 1337 } },
	{ player: 'Ben L.', choices: ['medic', 'soldier', 'engineer'], playtime: { medic: 100, soldier: 30 } },
	{ player: 'My mom', choices: ['medic'], playtime: { medic: 2 } },
	{ player: 'The guy who never changed his profile settings or played a game', choices: [], playtime: {} },
	{ player: 'Someone who plays all kinds of rocket', choices: ['soldier', 'pocket', 'roamer', 'engineer'], playtime: { soldier: 80, pocket: 15, roamer: 30 } },
	{ player: 'Look, ma! I played all the classes once without ever choosing any!', choices: [], playtime: { utility: 1, pocket: 1, roamer: 1, scout: 1, soldier: 1, pyro: 1, demo: 1, heavy: 1, engineer: 1, medic: 1, sniper: 1, spy: 1 } },
	{ player: 'Jane Doe', choices: ['soldier', 'roamer', 'pocket'], playtime: { soldier: 7, pocket: 2, roamer: 10 } },
	{ player: 'Tavish Degroot', choices: ['demo'], playtime: { demo: Number.MAX_VALUE } },
	{ player: 'Dell', choices: ['engineer'], playtime: { engineer: 18446744073709551615 } },
	{ player: 'Bad Luck Baseball Bill', choices: ['scout', 'utility'], playtime: { medic: 4 } },
	{ player: 'ENTIRE TEAM IS BABIES', choices: ['heavy'], playtime: { heavy: 400000 /* dollars */ } },
	{ player: 'Emergency Pyro', choices: ['pyro', 'utility'], playtime: { pyro: 10, utility: 3 } }
];

var classes = classchooser.chooseClasses( input.concat(), '6v6' );

process.stdin.resume();

var messageQueue = [];
var config = classchooser.getConfig();
classes.shuffle().forEach( function( position ) {
	var congrats = '';

	var player = input.filter( function( player ) {
		return player.player == position.player;
	} )[0];

	if ( player.games == 0 ) {
		congrats = 'Welcome to PubComp!';
	} else if ( player.games < 5 ) {
		congrats = 'This is game number ' + ( player.games + 1 ) + ' for ' + player.player + '!';
	} else if ( ( player.games + 1 ) % 1000 == 0 ) {
		congrats = 'Congratulations on game number ' + ( player.games + 1 ) + ', ' + player.player + '!';
	} else if ( player.choices[0] == position.role ) {
		congrats = 'Congratulations on getting your first choice!';
	} else if ( player.choices.length == 0 ) {
		congrats = 'You should choose your favorite classes in your profile settings.';
	} else if ( player.choices.indexOf( position.role ) == -1 ) {
		congrats = 'Think of this game as expanding your horizons.';
	}

	messageQueue.push( position.player + ' is a ' + {Blue: 'BLU', Red: 'RED'}[position.team] + ' ' + config.positions[position.role].name + '. ' + congrats );
} );

setInterval( function() {
	var message;
	if ( message = messageQueue.shift() ) {
		console.log( message );
	} else {
		process.exit();
	}
}, 2000 );
