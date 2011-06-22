#include <sourcemod>
#include <string>

#include "config.inc"
#include "version.inc"

/* Implementation notes:

* pubcomp_add_steamid RCON command (self-explanatory)
* Steam IDs are valid for 5 minutes or until the player joins the server. After that, they must be re-allowed by the RCON command above

*/
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
        RegConsoleCmd( "pubcomp_set_warmup_mod", CommandSetWarmupMod, "", FCVAR_PLUGIN);
        RegConsoleCmd( "pubcomp_add_game_command", CommandAddGameCommand, "", FCVAR_PLUGIN);
        RegConsoleCmd( "pubcomp_reset_game_commands", CommandResetGameCommands, "", FCVAR_PLUGIN);
        RegConsoleCmd( "pubcomp_add_game_position", CommandResetGameCommands, "", FCVAR_PLUGIN);

        RegConsoleCmd( "say", ReadyUnready, "", FCVAR_PLUGIN);

        ServerCommand("mp_waitingforplayers_cancel 1");
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
public Action:CommandResetGameCommands(client, args) {
        if ( client != 0 ) {
                LogMessage( "Client %d is not permitted to change PubComp game settings.", client );
		return Plugin_Stop;
	}
        for (new i = 0; i < commandCount; i++) {
                gameCommands[i][0] = 0;
        }
        commandCount = 0;
        return Plugin_Handled;
}

// Add a command to be executed when the match begins.
public Action:CommandAddGameCommand(client, args) {
        if ( client != 0 ) {
                LogMessage( "Client %d is not permitted to change PubComp game settings.", client );
		return Plugin_Stop;
	}

	decl String:command[MAX_COMMAND_LENGTH];
	GetCmdArgString(command, sizeof(command));

        strcopy(gameCommands[commandCount], MAX_COMMAND_LENGTH, command);
        commandCount++;
        return Plugin_Handled;
}

// Internal function that will execute the commands when the match begins.
public ExecuteGameCommands() {
        for (new i = 0; i < commandCount; i++) {
                ServerCommand(gameCommands[i]);
        }
}

// These functions and globals are for setting, activating and
// deactivating the desired pre-game/pause warmup mode.

#define NUM_WARMUP_MODES 2
#define ENABLE 0
#define DISABLE 1
new String:warmupModes[NUM_WARMUP_MODES + 1][16] = {"NONE", "SOAP", "MGE"};
new activeWarmupMode;
new String:warmupActivationCommands[NUM_WARMUP_MODES + 1][2][MAX_COMMAND_LENGTH] = {
        {"", ""},
        {"sm plugins load soap_tf2dm", "sm plugins unload soap_tf2dm"},
        {"sm plugins load mgemod", "sm plugins unload mgemod"}
};

public Action:CommandSetWarmupMod(client, args) {
        if ( client != 0 ) {
                LogMessage( "Client %d is not permitted to change the warmup mod.", client );
		return Plugin_Stop;
	}
	decl String:modeName[20];
	GetCmdArgString( modeName, sizeof( modeName ) );

        activeWarmupMode = -1;
        for (new i = 0; i < NUM_WARMUP_MODES + 1; i++) {
                if (strcmp(modeName, warmupModes[i]) == 0) {
                        activeWarmupMode = i;
                }
                ServerCommand(warmupActivationCommands[i][1]);
        }
        if (activeWarmupMode == -1) {
                LogMessage("Could not find warmup mode \"%s\".", modeName);
                return Plugin_Stop;
        }
        ServerCommand(warmupActivationCommands[activeWarmupMode][0]);

        return Plugin_Handled;
}

// Track player ready states and start a game when we have enough
// ready players.

new bool:playerReady[MAXPLAYERS+1];
new playersNeeded = 1;

new Handle:gameCountdown = INVALID_HANDLE;

public Action:ReadyUnready(client, args) {
        decl String:text[192];
        GetCmdArg(1, text, sizeof(text));

        if (strcmp(text, ".ready") == 0 || strcmp(text, ".gaben") == 0) {
                playerReady[client] = true;

                decl String:playerName[32];
                GetClientName(client, playerName, sizeof(playerName));
                PrintToChatAll("Player %s is now ready.", playerName);
        }

        if (strcmp(text, ".notready") == 0 || strcmp(text, ".unready") == 0) {
                playerReady[client] = false;

                decl String:playerName[32];
                GetClientName(client, playerName, sizeof(playerName));
                PrintToChatAll("Player %s is no longer ready.", playerName);
        }

        new readyCount = 0;
        for (new i = 0; i < MAXPLAYERS+1; i++) {
                readyCount += playerReady[i] ? 1 : 0;
        }
        if (readyCount == playersNeeded) {
                gameCountdown = CreateTimer(float(GAME_START_DELAY), Timer:PubCompStartGame);
                new seconds = GAME_START_DELAY % 60;
                new minutes = GAME_START_DELAY / 60;
                PrintToChatAll("%d players are now ready.", readyCount);
                if (minutes == 0) {
                        PrintToChatAll("Game Starts in %d seconds.", seconds);
                } else if (seconds == 0) {
                        PrintToChatAll("Game Starts in %d minutes.", minutes);
                } else {
                        PrintToChatAll("Game Starts in %d minutes and %d seconds.", minutes, seconds);
                }
        } else if (gameCountdown != INVALID_HANDLE) {
                KillTimer(gameCountdown);
                gameCountdown = INVALID_HANDLE;
                PrintToChatAll("Down to %d ready player%s.  Countdown canceled.", readyCount, readyCount == 1 ? "" : "s");
        } else {
        }

        return Plugin_Continue;
}

public Timer:PubCompStartGame(Handle:data) {
        // Tell node we're starting a game here.  Node should already
        // have the steamids of the players in the game, and their map
        // and position preferences will be entered through the web,
        // so it will have those as well.  So we don't have to send
        // anything except a message that we're starting the game.
        //
        // It should send us (through rcon console commands) team
        // assignments and position assignments.

        ServerCommand("mp_tournament 0");
        ServerCommand(warmupActivationCommands[activeWarmupMode][DISABLE]);
        // TODO: Put players on their respective teams and alert them
        // that they are now on that team.
        ServerCommand("mp_restartgame 1");
        CreateTimer(1.0, Timer:PubCompStartGame2);
}

public Timer:PubCompStartGame2(Handle:data) {
        PrintCenterTextAll("Setup Classes.  Game will start in %d seconds.", SETUP_CLASSES_TIME);
        LogToGame("Setup Classes.  Game will start in %d seconds.", SETUP_CLASSES_TIME);
        // TODO: Inform players of the classes they drew and engage
        // the class limit freezer.

        ServerCommand("mp_restartgame %d", SETUP_CLASSES_TIME);
        CreateTimer(float(SETUP_CLASSES_TIME + 1), Timer:PubCompStartGame3);
}

public Timer:PubCompStartGame3(Handle:data) {
        PrintCenterTextAll("----Game is LIVE----");
}
