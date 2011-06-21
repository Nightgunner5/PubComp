#include <sourcemod>
#include <string>

#include "config.inc"
#include "version.inc"

public Plugin:myinfo = {
	name = "PubComp",
	author = "The PubComp Team",
	description = "",
	version = PLUGIN_VERSION,
	url = "http://pubcomp.com/"
};

new String:steamID[32][20] = { "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "" };
new Float:steamIDExpire[32];
new bool:tickStarted = false;
new bool:pubCompBotKicked = false;
new String:gameCommands[MAX_COMMANDS][MAX_COMMAND_LENGTH];
new commandCount = 0;

public OnPluginStart() {
	RegConsoleCmd( "pubcomp_add_steamid", CommandAddSteamID, "", FCVAR_PLUGIN );
	RegConsoleCmd( "pubcomp_set_warmup_mod", CommandSetWarmupMod, "", FCVAR_PLUGIN );
	RegConsoleCmd( "pubcomp_add_game_command", CommandAddGameCommand, "", FCVAR_PLUGIN );
	RegConsoleCmd( "pubcomp_reset_game_commands", CommandResetGameCommands, "", FCVAR_PLUGIN );
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
	// Don't kick the SourceTV bot or the replay bot.
	if ( StrEqual( auth, "BOT" ) ) {
		decl String:botName[MAX_NAME_LENGTH];
		GetClientName( client, botName, MAX_NAME_LENGTH );
		decl String:sourceTV[MAX_NAME_LENGTH];
		new Handle:_sourceTV = FindConVar( "tv_name" );
		GetConVarString( _sourceTV, sourceTV, MAX_NAME_LENGTH );
		CloseHandle( _sourceTV );
		if ( StrEqual( botName, "replay" ) || StrEqual( botName, sourceTV ) )
			return;
	}

	new bool:foundSteamID = findSteamID( auth );

	if ( !foundSteamID ) {
		KickClient( client, "Please join from the PubComp web interface" );
	}
}

public OnClientDisconnect_Post( client ) {
	if ( !pubCompBotKicked ) {
		pubCompBotKicked = true;
		return;
	}
}

public OnClientPutInServer( client ) {
	decl String:map[PLATFORM_MAX_PATH];
	GetCurrentMap( map, PLATFORM_MAX_PATH );
	if ( StrEqual( map, "mge_training_v7" ) ) {
		FakeClientCommand( client, "say /first" );
	}
}


// These functions allow the rcon user to add settings that will take
// effect when the actual match begins.

// Wipe out all previously added commands.
public Action:CommandResetGameCommands( client, args ) {
	if ( client != 0 ) {
		LogMessage( "Client %d is not permitted to change PubComp game settings.", client );
		return Plugin_Stop;
	}
	for ( new i = 0; i < commandCount; i++ ) {
		gameCommands[i][0] = 0;
	}
	commandCount = 0;
	return Plugin_Handled;
}

// Add a command to be executed when the match begins.
public Action:CommandAddGameCommand( client, args ) {
	if ( client != 0 ) {
		LogMessage( "Client %d is not permitted to change PubComp game settings.", client );
		return Plugin_Stop;
	}

	decl String:command[MAX_COMMAND_LENGTH];
	GetCmdArgString( command, sizeof( command ) );

	if ( commandCount + 1 == MAX_COMMANDS ) {
		LogMessage( "Failed to add command \"%s\" to buffer; Command list is full.", command );
		return Plugin_Stop;
	}

	strcopy( gameCommands[commandCount], MAX_COMMAND_LENGTH, command );
	commandCount++;
	return Plugin_Handled;
}

// Internal function that will execute the commands when the match begins.
public ExecuteGameCommands() {
	for ( new i = 0; i < commandCount; i++ ) {
		ServerCommand(gameCommands[i]);
	}
}

// These functions and globals are for setting, activating and
// deactivating the desired pre-game/pause warmup mode.

#define NUM_WARMUP_MODES 2
new String:warmupModes[NUM_WARMUP_MODES + 1][16] = {"NONE", "SOAP", "MGE"};
new activeWarmupMode;
new String:warmupActivationCommands[NUM_WARMUP_MODES + 1][2][MAX_COMMAND_LENGTH] = {
	{"", ""},
	{"sm plugins load soap_tf2dm", "sm plugins unload soap_tf2dm"},
	{"sm plugins load mgemod", "sm plugins unload mgemod"}
};

public Action:CommandSetWarmupMod( client, args ) {
	if ( client != 0 ) {
		LogMessage( "Client %d is not permitted to change the warmup mod.", client );
		return Plugin_Stop;
	}
	decl String:modeName[20];
	GetCmdArgString( modeName, sizeof( modeName ) );

	activeWarmupMode = 0;
	for ( new i = 0; i < NUM_WARMUP_MODES + 1; i++ ) {
		if ( strcmp(modeName, warmupModes[i]) == 0 ) {
			activeWarmupMode = i;
		}
		ServerCommand( warmupActivationCommands[i][1] );
	}
	if ( activeWarmupMode == 0 ) {
		LogMessage( "Could not find warmup mode \"%s\".", modeName );
		return Plugin_Stop;
	}
	ServerCommand( warmupActivationCommands[activeWarmupMode][0] );

	return Plugin_Handled;
}
