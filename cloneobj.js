// Input: from (object) to (object)
// Output: { minus: (things removed from to), plus: (things added to to) }
// to will be modified so it is a clone of from. from will not be modified.
module.exports = function cloneObj( to, from ) {
	var diffMinus = {},
		diffPlus = {};
	for ( var key in from ) {
		if ( to[key] == from[key] ) continue;
		if ( typeof from[key] == 'object' ) {
			if ( key in to ) {
				if ( typeof to[key] != 'object' ) {
					diffMinus[key] = to[key];
					to[key] = {};
					diffPlus[key] = cloneObj( to[key], from[key] ).plus;
				} else {
					var tmp = cloneObj( to[key], from[key] );
					if ( Object.keys( tmp.minus ).length || Object.keys( tmp.plus ).length ) {
						diffMinus[key] = tmp.minus;
						diffPlus[key] = tmp.plus;
					}
				}
			} else {
				to[key] = {};
				diffPlus[key] = cloneObj( to[key], from[key] ).plus;
			}
		} else {
			if ( key in to ) {
				if ( typeof to[key] == 'object' ) {
					diffMinus[key] = cloneObj( to[key], {} ).minus;
					diffPlus[key] = to[key] = from[key];
				} else {
					diffMinus[key] = to[key];
					diffPlus[key] = to[key] = from[key];
				}
			} else {
				diffPlus[key] = to[key] = from[key];
			}
		}
	}
	for ( var key in to ) {
		if ( !( key in from ) ) {
			diffMinus[key] = to[key];
			delete to[key];
		}
	}
	return {
		minus: diffMinus,
		plus: diffPlus
	};
}
