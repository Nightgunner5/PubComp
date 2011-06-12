var maps = exports.maps = ['tc_hydro', 'cp_well', 'cp_granary', 'cp_dustbowl', 'cp_gravelpit',
			'ctf_2fort', 'ctf_well', 'cp_badlands', 'pl_goldrush', 'cp_fastlane',
			'ctf_turbine', 'pl_badwater', 'cp_steel', 'cp_egypt_final',
			'cp_junction_final', 'plr_pipeline', 'pl_hoodoo_final', 'koth_sawmill',
			'koth_nucleus', 'koth_viaduct', 'ctf_sawmill', 'cp_yukon_final',
			'koth_harvest_final', 'koth_harvest_event', 'ctf_doublecross',
			'cp_gorge', 'cp_freight_final1', 'pl_upward', 'plr_hightower',
			'pl_thundermountain', 'cp_coldfront', 'cp_mountainlab', 'cp_manor_event',
			'cp_degrootkeep', 'cp_5gorge', 'pl_frontier_final', 'plr_nightfall_final',
			'koth_lakeside_final', 'koth_badlands'];

if ( !Array.prototype.shuffle ) {
    Array.prototype.shuffle = function() {
        var result = this.slice( 0 );

        for (var i = 0; i < result.length; i++) {
            var j = Math.floor(Math.random() * result.length);
            var contents = result[i];
            result[i] = result[j];
            result[j] = contents;
        }

        return result;
    };
}

function transformPlayed( played ) {
	// Get the number of times each map has been played in the last 4 maps.
	var numOccurances = {};
	played.forEach( function( map ) {
		numOccurances[map] ? numOccurances[map]++ : ( numOccurances[map] = 1 );
	} );

	// In order: 4 times played, 3 times starting with last played, 3 times
	// starting with second last played, 2 times first, 2 times second, 2 times
	// third, first, second, third, fourth.
	//
	// These maps are moved to the bottom of the priority list so 4 times played
	// would be last, etc.
	var transformed = [];
	played.forEach( function( map ) {
		if ( transformed.indexOf( map ) != -1 )
			return;
		for ( var i = 0; i < transformed.length; i++ ) {
			if ( numOccurances[map] > numOccurances[transformed[i]] ) {
				transformed.splice( i, 0, map );
				return;
			}
		}
		transformed.push( map );
	} );

	return transformed.reverse();
}


//	realPriorities = ['cp_badlands', 'cp_granary', 'cp_gravelpit', 'cp_freight_final1', ''], // All non-listed maps are ranked where the empty string is (tied)
//	lastPlayed = ['cp_granary', 'cp_badlands', 'cp_freight_final1', 'cp_badlands']; // Only the first four are used.
exports.transformPriorities = function( realPriorities, lastPlayed ) {
	var priorities = realPriorities.slice( 0 ), unusedMaps = maps.slice( 0 ).filter( function( map ){ return priorities.indexOf( map ) == -1; } );
	unusedMaps.shuffle();
	priorities.splice.apply(priorities, [priorities.indexOf( '' ), 1].concat( unusedMaps ) );
	var played = transformPlayed( lastPlayed.slice( 0, 4 ) );
	played.forEach( function( map ) {
		priorities.splice( priorities.indexOf( map ), 1 );
		priorities.push( map );
	} );

	return priorities;
}