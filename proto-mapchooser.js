const maps = ['tc_hydro', 'cp_well', 'cp_granary', 'cp_dustbowl', 'cp_gravelpit', 'ctf_2fort', 'ctf_well', 'cp_badlands', 'pl_goldrush', 'cp_fastlane', 'ctf_turbine', 'pl_badwater', 'cp_steel', 'cp_egypt_final', 'cp_junction_final', 'plr_pipeline', 'pl_hoodoo_final', 'koth_sawmill', 'koth_nucleus', 'koth_viaduct', 'ctf_sawmill', 'cp_yukon_final', 'koth_harvest_final', 'koth_harvest_event', 'ctf_doublecross', 'cp_gorge', 'cp_freight_final1', 'pl_upward', 'plr_hightower', 'pl_thundermountain', 'cp_coldfront', 'cp_mountainlab', 'cp_manor_event', 'cp_degrootkeep', 'cp_5gorge', 'pl_frontier_final', 'plr_nightfall_final', 'koth_lakeside_final', 'koth_badlands'],
	playerChoices = [
		['cp_dustbowl', 'ctf_2fort', 'cp_badlands', 'koth_nucleus', 'cp_degrootkeep'],
		['cp_badlands', 'cp_granary', 'cp_dustbowl', 'koth_sawmill', 'cp_gravelpit'],
		['cp_granary', 'cp_badlands', 'cp_dustbowl', 'cp_well', 'cp_gorge']
	],
	lastMaps = [
		[],
		['cp_badlands'],
		[]
	], iterations = 10;

function scoreMap( map ) {
	var score = Math.random() * 10;
	for ( var player in playerChoices ) {
		var lastPlayed = lastMaps[player].indexOf( map );
		if ( lastPlayed != -1 && lastPlayed < 5 )
			score -= Math.pow( 5 - lastPlayed, 2 );
		var choiceNumber = playerChoices[player].indexOf( map );
		if ( choiceNumber != -1 )
			score += Math.pow( 2, -choiceNumber ) * 10;
	}
	return score;
}

function sortMaps( a, b ) {
	return b[1] - a[1];
}

for ( var i = 0; i < iterations; i++ ) {
	var scores = [];

	for ( var map in maps ) {
		scores.push( [maps[map], scoreMap( maps[map] )] );
	}
	scores.sort( sortMaps );
	for ( var player in lastMaps ) {
		lastMaps[player].unshift( scores[0][0] );
	}

	console.log( 'Map: %s with score %d; runner-up: %s with score %d', scores[0][0], Math.floor( scores[0][1] * 100 ) / 100, scores[1][0], Math.floor( scores[1][1] * 100 ) / 100 );
}
