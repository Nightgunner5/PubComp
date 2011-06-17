<?php
/*
Plugin Name: PubComp
Plugin URL: http://pubcomp.com/
Description: PubComp support plugin
Version: 0.1
Author: The PubComp team
Author URL: http://pubcomp.com/
*/

add_action( 'bp_before_account_details_fields', 'pubcomp_before_account_details' );
add_action( 'bp_after_account_details_fields', 'pubcomp_clear_buffer' );
add_action( 'bp_before_signup_profile_fields', 'pubcomp_before_signup_profile' );
add_action( 'bp_after_signup_profile_fields', 'pubcomp_clear_buffer' );

function pubcomp_get_openid() {
	static $openid = null;
	if ( $openid )
		return $openid;
	require_once dirname( __FILE__ ) . '/openid.php';
	$openid = new LightOpenID;
	return $openid;
}

function pubcomp_fetch_player( $identity ) {
	$id = str_replace( 'http://steamcommunity.com/openid/id/', '', $identity );
	if ( !$player = get_transient( 'pubcomp_steam_user_' . $id ) ) {
		$url = 'http://api.steampowered.com/ISteamUser/GetPlayerSummaries/v0002/?key=' . PUBCOMP_STEAM_KEY . '&steamids=' . $id;
		$request = wp_remote_get( $url );
		$request['body'] = preg_replace( '/: (\d+),/', ': "$1",', $request['body'] );
		$player = json_decode( $request['body'], true );
		$player = $player['response']['players'][0];
		set_transient( 'pubcomp_steam_user_' . $id, $player, 3600 );
	}
	return $player;
}

function pubcomp_init() {
	global $pubcomp_signup_message;
	if ( isset( $_POST['steam_login'] ) && isset( $_POST['pubcomp_wpnonce'] ) && wp_verify_nonce( $_POST['pubcomp_wpnonce'], 'steam_login-' . $_POST['steam_login'] ) ) {
		if ( is_email( $_POST['email'] ) ) {
			$user = wp_create_user( 'steam_' . $_POST['steam_login'], wp_generate_password( 32 ), $_POST['email'] );
			$player = pubcomp_fetch_player( $_POST['steam_login'] );
			if ( is_wp_error( $user ) ) {
				$pubcomp_signup_message = 'There was an error registering your account. Did you already register?';
			} else {
				add_user_meta( $user, 'pubcomp_steam_id', $player['steamid'] );
				update_user_meta( $user, 'display_name', $player['personaname'] );
				$pubcomp_signup_message = 'All set! Now you can log in.';
			}
		} else {
			$player = pubcomp_fetch_player( $_POST['steam_login'] );
			$pubcomp_signup_message = 'That doesn\'t look like an email address to me...' .
			'<input type="text" name="email" placeholder="Email address" />' .
			'<input type="hidden" name="steam_login" value="' . $player['steamid'] . '" />' .
			'<input type="hidden" name="pubcomp_wpnonce" value="' . wp_create_nonce( 'steam_login-' . $player['steamid'] ) . '"/>';
		}
	}
	if ( isset( $_POST['signup_submit'] ) )
		unset( $_POST['signup_submit'] );

	if ( ( isset( $_POST['steam_login'] ) && $_POST['steam_login'] == 'go' ) || ( basename( $_SERVER['PHP_SELF'] ) == 'wp-login.php' && !isset( $_GET['openid_ns'] ) && ( !isset( $_GET['action'] ) || $_GET['action'] != 'logout' ) ) ) {
		pubcomp_get_openid()->identity = 'http://steamcommunity.com/openid';
		header( 'Location: ' . pubcomp_get_openid()->authUrl() );
		exit;
	} elseif ( basename( $_SERVER['PHP_SELF'] ) == 'wp-login.php' && isset( $_GET['openid_ns'] ) ) {
		$openid = pubcomp_get_openid();
		if ( $openid->validate() ) {
			$player = pubcomp_fetch_player( $openid->identity );
			$user = get_user_by( 'login', 'steam_' . $player['steamid'] );
			if ( $user && !is_wp_error( $user ) ) {
				update_user_meta( $user->ID, 'display_name', $player['personaname'] );
				wp_set_auth_cookie( $user->ID, true );
				if ( empty( $_GET['redirect_to'] ) )
					$_GET['redirect_to'] = get_home_url();
				header( 'Location: ' . $_GET['redirect_to'] );
				exit;
			}
		}
		header( 'Location: ' . get_home_url() );
		exit;
	}
}
add_action( 'init', 'pubcomp_init' );

function pubcomp_before_account_details() {
	try {
		$openid = pubcomp_get_openid();
		if ( isset( $GLOBALS['pubcomp_signup_message'] ) ) {
			echo $GLOBALS['pubcomp_signup_message'];
		} elseif ( !$openid->mode || !$openid->validate() ) {
?>
			<input type="hidden" name="steam_login" value="go" />
			<input type="submit" value="Sign in with Steam" />
<?php
		} else {
			$player = pubcomp_fetch_player( $openid->identity );
			echo 'Hello, ', esc_html( $player['personaname'] ), '! Enter your email address to complete registration.';
?>
			<input type="text" name="email" placeholder="Email address" />
			<input type="hidden" name="steam_login" value="<?php echo $player['steamid']; ?>" />
			<input type="hidden" name="pubcomp_wpnonce" value="<?php echo wp_create_nonce( 'steam_login-' . $player['steamid'] ); ?>" />
<?php
		}
	} catch( ErrorException $e ) {
		echo 'Whoops! There was an error.';
	}
	ob_start();
}

function pubcomp_before_signup_profile() { ob_start(); }

function pubcomp_clear_buffer() { ob_end_clean(); }
