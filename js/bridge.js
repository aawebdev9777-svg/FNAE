(function() {
    const PARENT = window.parent !== window ? window.parent : null;
    const LOGIN_KEY = 'fnae_game_login';
    let pendingCallbacks = [];
    let nextReqId = 1;

    const loginOverlay = document.getElementById('login-overlay');
    const leaderboardOverlay = document.getElementById('leaderboard-overlay');
    const loginSubmit = document.getElementById('login-submit');
    const loginClose = document.getElementById('login-close');
    const loginError = document.getElementById('login-error');
    const loginUsername = document.getElementById('login-username');
    const loginPassword = document.getElementById('login-password');
    const leaderboardBtn = document.getElementById('leaderboard-btn');
    const leaderboardList = document.getElementById('leaderboard-list');
    const leaderboardClose = document.getElementById('leaderboard-close');
    const loginIndicator = document.getElementById('login-indicator');

    function getLogin() {
        try { return JSON.parse(sessionStorage.getItem(LOGIN_KEY) || 'null'); }
        catch (e) { return null; }
    }
    function setLogin(data) {
        if (data) sessionStorage.setItem(LOGIN_KEY, JSON.stringify(data));
        else sessionStorage.removeItem(LOGIN_KEY);
        updateIndicator();
    }
    function updateIndicator() {
        if (!loginIndicator) return;
        const l = getLogin();
        if (l) {
            loginIndicator.textContent = 'LOGGED IN: ' + l.username.toUpperCase();
            loginIndicator.classList.add('logged-in');
        } else {
            loginIndicator.textContent = 'NOT LOGGED IN';
            loginIndicator.classList.remove('logged-in');
        }
    }

    function send(type, payload) {
        return new Promise((resolve) => {
            if (!PARENT) { resolve({ ok: false, error: 'No parent window' }); return; }
            const reqId = nextReqId++;
            const handler = (e) => {
                if (!e.data || e.data.reqId !== reqId) return;
                window.removeEventListener('message', handler);
                resolve(e.data);
            };
            window.addEventListener('message', handler);
            PARENT.postMessage(Object.assign({ type: type, reqId: reqId }, payload || {}), '*');
            setTimeout(() => { window.removeEventListener('message', handler); resolve({ ok: false, error: 'timeout' }); }, 12000);
        });
    }

    function showLoginOverlay(onSuccess) {
        if (!loginOverlay) { if (onSuccess) onSuccess(); return; }
        loginOverlay.classList.remove('hidden');
        loginError.textContent = '';
        if (loginUsername) loginUsername.focus();
        pendingCallbacks.push(onSuccess);
    }
    function hideLoginOverlay() {
        if (loginOverlay) loginOverlay.classList.add('hidden');
    }

    async function doLogin() {
        const username = loginUsername.value.trim();
        const password = loginPassword.value;
        if (!username || !password) { loginError.textContent = 'Enter username and password'; return; }
        if (loginSubmit) { loginSubmit.disabled = true; loginSubmit.textContent = '...'; }
        const res = await send('login', { username: username, password: password });
        if (loginSubmit) { loginSubmit.disabled = false; loginSubmit.textContent = 'LOGIN / REGISTER'; }
        if (res.ok) {
            setLogin({ username: username, password: password });
            hideLoginOverlay();
            const cbs = pendingCallbacks; pendingCallbacks = [];
            cbs.forEach(function(cb) { try { cb(); } catch (e) {} });
            if (loginUsername) loginUsername.value = '';
            if (loginPassword) loginPassword.value = '';
        } else {
            loginError.textContent = res.error || 'Login failed';
        }
    }

    if (loginSubmit) loginSubmit.addEventListener('click', doLogin);
    if (loginClose) loginClose.addEventListener('click', hideLoginOverlay);
    if (loginPassword) loginPassword.addEventListener('keydown', function(e) { if (e.key === 'Enter') doLogin(); });

    async function showLeaderboard() {
        if (!leaderboardOverlay) return;
        leaderboardOverlay.classList.remove('hidden');
        if (leaderboardList) leaderboardList.innerHTML = '<div class="lb-loading">LOADING...</div>';
        const res = await send('getLeaderboard', {});
        if (!res.ok || !res.entries) { if (leaderboardList) leaderboardList.innerHTML = '<div class="lb-empty">Unable to load</div>'; return; }
        if (res.entries.length === 0) { if (leaderboardList) leaderboardList.innerHTML = '<div class="lb-empty">No scores yet</div>'; return; }
        if (leaderboardList) {
            leaderboardList.innerHTML = res.entries.map(function(e, i) {
                var medal = i === 0 ? '1' : i === 1 ? '2' : i === 2 ? '3' : String(i + 1);
                return '<div class="lb-row"><span class="lb-rank">' + medal + '</span><span class="lb-name">' + e.username + '</span><span class="lb-night">N' + e.night + '</span><span class="lb-score">' + e.score + '</span></div>';
            }).join('');
        }
    }
    if (leaderboardBtn) leaderboardBtn.addEventListener('click', showLeaderboard);
    if (leaderboardClose) leaderboardClose.addEventListener('click', function() { leaderboardOverlay.classList.add('hidden'); });

    window.GameBridge = {
        isLoggedIn: function() { return !!getLogin(); },
        requireLogin: function(onSuccess) {
            if (getLogin()) return true;
            showLoginOverlay(onSuccess);
            return false;
        },
        submitScore: async function(data) {
            var l = getLogin();
            if (!l) return { ok: false, error: 'Not logged in' };
            return await send('submitScore', { username: l.username, password: l.password, night: data.night, result: data.result, power: data.power });
        }
    };

    updateIndicator();
})();
