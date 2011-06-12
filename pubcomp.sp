#include <sourcemod>

/* Implementation notes:

* pubcomp_add_steamid RCON command (self-explanatory)
* Steam IDs are valid for 5 minutes or until the player joins the server. After that, they must be re-allowed by the RCON command above

*/
public Plugin:myinfo = {
	name = "PubComp",
	author = "The PubComp Team",
	description = "",
	version = "0.1-A",
	url = "http://pubcomp.com/"
};

new String:steamID[32][20] = { "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" };
new Float:steamIDExpire[32];
new bool:tickStarted = false;
new bool:pubCompBotKicked = false;

public OnPluginStart() {
	RegConsoleCmd( "pubcomp_add_steamid", CommandAddSteamID, "", FCVAR_PLUGIN );
}

bool:findSteamID( const String:id[] ) {
	for ( new i = 0; i < 32; i++ ) {
		if ( StrEqual( id, steamID[i] ) ) {
			steamID[i][0] = 0;
			return ( steamIDExpire[i] >= GetGameTime() );
		}
	}
	return false;
}

/*public Action:Timer_NobodyJoined( Handle:timer ) {
	if ( GetClientCount( false ) == 0 ) {
		LogMessage( "Shutting down server; no clients have connected." );
		ServerCommand( "quit" );
	}

	return Plugin_Handled;
}*/

public Action:CommandAddSteamID( client, args ) {	  
	if ( client != 0 ) {
		LogMessage( "Client %d is not permitted to add users to the whitelist.", client );
		return Plugin_Stop;
	}
	decl String:id[20];
	GetCmdArgString( id, sizeof( id ) );

	findSteamID( id );

	if ( !tickStarted ) {
		CreateFakeClient( "PubComp" ); // Will be auto-kicked; we need this to start the server ticking.
		tickStarted = true;
	}

	for ( new i = 0; i < 32; i++ ) {
		if ( steamID[i][0] == 0 || steamIDExpire[i] < GetGameTime() ) {
			strcopy( steamID[i], 20, id );
			steamIDExpire[i] = GetGameTime() + 300.0; // 5 minutes to join
			LogMessage( "Added %s to the whitelist.", id );
			return Plugin_Handled;
		}
	}

	LogMessage( "Failed to add %s to the whitelist. Whitelist is full.", id );
	return Plugin_Handled;
}

public OnClientAuthorized( client, const String:auth[] ) {
	new bool:foundSteamID = findSteamID( auth );

	if ( !foundSteamID ) {
		KickClient( client, "Please join from the PubComp web interface.", auth );
	}
}

public OnClientDisconnect_Post( client ) {
	if ( !pubCompBotKicked ) {
		pubCompBotKicked = true;
		return;
	}

	//if ( GetClientCount( false ) == 0 ) {
	//	LogMessage( "Shutting down server; all clients have disconnected." );
	//	ServerCommand( "quit" );
	//}
}
