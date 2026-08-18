/**
 * Shared controller for the Welcome/About dialog. The dialog auto-opens on first
 * load (unless dismissed) and can be reopened anytime via the header `?` button.
 */
let welcomeOpenState = $state(false);

export function welcomeOpen() {
	return welcomeOpenState;
}

export function showWelcome() {
	welcomeOpenState = true;
}

export function hideWelcome() {
	welcomeOpenState = false;
}

export function toggleWelcome() {
	welcomeOpenState = !welcomeOpenState;
}
