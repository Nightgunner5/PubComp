var classchooser = require( './classchooser' );

classchooser.firstChoice['6v6'] = {
	scout: 1000,
	pocketsoldier: 600,
	roamingsoldier: 2000,
	demoman: 700,
	medic: 100
};

console.log( classchooser.chooseClasses( [
	{ player: 'GabeN', choices: ['spy', 'demoman', 'roamingsoldier', 'pyro'], playtime: { spy: 1337 } },
	{ player: 'Ben L.', choices: ['medic', 'soldier', 'engineer'], playtime: { medic: 2, soldier: 1 } }
], '6v6' ) );
