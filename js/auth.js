const SESSION_KEY = 'solarbookedSession';

// Reads the saved session from localStorage.
function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
  } catch (error) {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

// Saves an authenticated session to localStorage.
function saveSession(email) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ loggedIn: true, email }));
}

// Redirects protected pages to the login screen when no session exists.
function requireAuth() {
  const session = getSession();
  if (!session || session.loggedIn !== true) {
    window.location.href = 'index.html';
  }
}

// Redirects logged-in users away from the login screen.
function redirectIfAuthenticated() {
  const session = getSession();
  if (session && session.loggedIn === true) {
    window.location.href = 'dashboard.html';
  }
}

// Clears the current session and returns to the login screen.
function logout() {
  localStorage.removeItem(SESSION_KEY);
  window.location.href = 'index.html';
}

// Wires up the login form validation and redirect flow.
function initLogin() {
  redirectIfAuthenticated();
  const form = document.getElementById('loginForm');
  const error = document.getElementById('loginError');
  if (!form) return;

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    if (email === CONFIG.AUTH.email && password === CONFIG.AUTH.password) {
      saveSession(email);
      window.location.href = 'dashboard.html';
      return;
    }
    error.textContent = 'Invalid email or password. Please try again.';
    error.classList.add('show');
  });
}

// Wires up logout buttons on authenticated pages.
function initLogout() {
  document.querySelectorAll('[data-logout]').forEach((button) => {
    button.addEventListener('click', logout);
  });
}
