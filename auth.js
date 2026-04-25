function checkAuth() {
  const userStr = localStorage.getItem('polis_user');
  const authWrapper = document.getElementById('auth-wrapper');
  
  if (!authWrapper) return;
  
  const isIndex = window.location.pathname.endsWith('index.html') || window.location.pathname === '/';
  const addAction = isIndex ? '' : `onclick="window.location.href='index.html'"`;

  if (userStr) {
    const user = JSON.parse(userStr);
    authWrapper.innerHTML = `
      <div style="display: flex; align-items: center; gap: 0.75rem;">
        <div style="width: 36px; height: 36px; border-radius: 50%; background: var(--primary); color: white; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 1rem; box-shadow: var(--shadow-sm);">
          ${user.initials}
        </div>
        <div style="display: flex; flex-direction: column; text-align: left;">
          <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-main); line-height: 1.2;">${user.name}</span>
          <a href="#" onclick="logoutUser(event)" style="font-size: 0.75rem; color: var(--cat-safety); text-decoration: none; font-weight: 500;">Logout</a>
        </div>
        <button class="btn-primary" id="btn-add-issue" ${addAction} style="margin-left: 1rem; padding: 0.5rem 1rem;">+ Add Issue</button>
      </div>
    `;
  } else {
    authWrapper.innerHTML = `
      <button class="btn-secondary" onclick="window.location.href='login.html'">Login</button>
      <button class="btn-primary" id="btn-add-issue" ${addAction}>+ Add Issue</button>
    `;
  }
}

function logoutUser(e) {
  e.preventDefault();
  localStorage.removeItem('polis_user');
  window.location.reload();
}

document.addEventListener('DOMContentLoaded', checkAuth);
