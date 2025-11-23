/* app.js
 - Link-invite tokens are read from ./tokens.json on load (if present).
 - Admin panel can generate tokens locally and export tokens.json for upload.
 - Tokens structure:
   [{
     token: "AB12CD",
     type: "single" | "multi",
     uses: 1,               // remaining uses (for single/multi)
     maxUses: 1,            // initial max uses
     createdAt: 162...,     // ms
     expiresAt: 0           // ms epoch, 0 = never
   }]
*/

const TOKEN_URL = './tokens.json'; // hosted tokens file path (change if necessary)
const ADMIN_PASSWORD = 'admin123'; // change after deploy for safety

// UI refs
const $ = id => document.getElementById(id);
const show = el => el.classList.remove('hidden');
const hide = el => el.classList.add('hidden');

// runtime vars
let tokensList = [];       // loaded from tokens.json (external)
let sessionValidated = false;
let validatedToken = null;
let currentUser = null;

/* ---------------- Token Loader ---------------- */
async function loadHostedTokens(){
  try {
    const r = await fetch(TOKEN_URL + '?_=' + Date.now(), {cache: 'no-store'});
    if (!r.ok) return []; // no tokens.json published yet
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  } catch (e) {
    console.warn('No hosted tokens or offline', e);
    return [];
  }
}

/* ---------------- Token Validator ---------------- */
function validateTokenInput(raw){
  if (!raw) return false;
  // normalize (strip url hash prefix if present)
  raw = raw.trim();
  if (raw.includes('#token=')) raw = raw.split('#token=')[1];
  const token = raw.replace(/\s+/g,'').toUpperCase();
  const found = tokensList.find(t => t.token === token);
  if (!found) return false;

  // check expiry
  if (found.expiresAt && found.expiresAt < Date.now()) return false;

  // check uses
  if (found.uses !== undefined && found.uses <= 0) return false;

  // valid
  return found;
}

/* ---------------- Admin tools (local only) ---------------- */
function randomToken(len=8, prefix=''){
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // avoid ambiguous chars
  let s = prefix || '';
  for (let i=0;i<len;i++) s += chars.charAt(Math.floor(Math.random()*chars.length));
  return s;
}

function renderTokenList(){
  const el = $('token-list');
  if (!el) return;
  if (!tokensList.length) { el.innerHTML = '<p class="msg">No tokens published yet.</p>'; return; }
  el.innerHTML = tokensList.map(t=>{
    const exp = t.expiresAt ? (new Date(t.expiresAt)).toLocaleString() : 'never';
    return `<p><strong>${t.token}</strong> — ${t.type} — uses: ${t.uses}/${t.maxUses} — expires: ${exp}</p>`;
  }).join('');
}

function exportTokensJSON(){
  const blob = new Blob([JSON.stringify(tokensList,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'tokens.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

async function copyTokensJSON(){
  try {
    await navigator.clipboard.writeText(JSON.stringify(tokensList,null,2));
    alert('tokens.json copied to clipboard — paste into your repo file and commit.');
  } catch (e){
    alert('Copy failed. You can export tokens.json as a file instead.');
  }
}

/* ---------------- Admin UI handlers ---------------- */
$('btn-admin-login').onclick = async ()=>{
  const pass = $('admin-pass').value || '';
  if (pass !== ADMIN_PASSWORD){ alert('Wrong admin password'); return; }
  show($('admin-panel'));
  hide($('admin-pass'));
  hide($('btn-admin-login'));
  show($('btn-reset-all')); // visible now
  tokensList = await loadHostedTokens() || []; // preload hosted tokens if any
  renderTokenList();
};

$('btn-generate').onclick = ()=>{
  const prefix = $('new-token-prefix').value.trim().toUpperCase();
  const type = $('new-token-type').value;
  const uses = Math.max(1, parseInt($('new-token-uses').value || '1'));
  const days = Math.max(0, parseInt($('new-token-days').value || '0'));
  const tkn = randomToken(6, prefix);
  const now = Date.now();
  const expiresAt = days>0 ? now + days*24*3600*1000 : 0;
  const tokObj = { token: tkn, type, uses, maxUses: uses, createdAt: now, expiresAt };
  tokensList.push(tokObj);
  renderTokenList();
};

$('btn-export-json').onclick = exportTokensJSON;
$('btn-copy-json').onclick = copyTokensJSON;
$('btn-reset-all').onclick = ()=>{
  if (!confirm('Delete all tokens locally? (You must re-upload an empty tokens.json to clear hosted tokens)')) return;
  tokensList = [];
  renderTokenList();
};

/* ---------------- Token validation from input or URL ---------------- */
async function tryValidateFromURLorInput(){
  // load hosted tokens first
  tokensList = await loadHostedTokens();
  renderTokenList();

  // check URL hash
  const rawHash = location.hash || '';
  let candidate = '';
  if (rawHash.includes('token=')) candidate = rawHash.split('token=')[1];

  // also check input field
  const inputVal = $('tokenInput') ? $('tokenInput').value.trim() : '';

  const raw = candidate || inputVal;
  if (!raw) return false;
  const found = validateTokenInput(raw);
  if (!found) return false;

  // Mark session validated (note: single-use tokens require admin to re-upload tokens.json with decremented uses)
  sessionValidated = true;
  validatedToken = found.token;
  // If token is multi or single, we *do not* auto-decrement hosted token here (since only repo admin can update hosted file).
  // We allow single-use tokens by expectation: admin will replace tokens.json to decrement uses after issuing tokens.
  // But to help offline workflows, store validated token locally to allow immediate use:
  localStorage.setItem('streak_token_valid', found.token);
  return true;
}

/* ---------------- AUTH (local accounts stored in IDB) ---------------- */
async function hashPw(pw){
  const enc = new TextEncoder().encode(pw);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

$('btn-validate').onclick = async ()=>{
  $('gate-msg').innerText = 'Checking...';
  const ok = await tryValidateFromURLorInput();
  if (ok){
    $('gate-msg').innerText = 'Token valid — continue to create an account or login.';
    proceedToAuth();
  } else {
    $('gate-msg').innerText = 'Invalid or expired token. Ensure tokens.json is uploaded by admin and token is correct.';
  }
};

function proceedToAuth(){
  hide($('gate'));
  show($('auth'));
  // wire auth UI
  $('show-signup').onclick = ()=>{ hide($('login-form')); show($('signup-form')); };
  $('show-login').onclick = ()=>{ hide($('signup-form')); show($('login-form')); };

  $('btn-signup').onclick = async ()=>{
    const u = $('signup-username').value.trim();
    const p = $('signup-password').value || '';
    if (!u || !p) { $('signup-msg').innerText = 'Fill both fields'; return; }
    const exists = await IDB.getUser(u);
    if (exists) { $('signup-msg').innerText = 'Username already taken'; return; }
    const hash = await hashPw(p);
    const userObj = { username: u, passwordHash: hash, xp:0, createdAt:Date.now() };
    await IDB.putUser(userObj);
    $('signup-msg').innerText = 'Account created — you can login now';
    setTimeout(()=>{ $('show-login').click(); },700);
  };

  $('btn-login').onclick = async ()=>{
    const u = $('login-username').value.trim();
    const p = $('login-password').value || '';
    if (!u || !p) { $('login-msg').innerText = 'Enter credentials'; return; }
    const rec = await IDB.getUser(u);
    if (!rec){ $('login-msg').innerText = 'User not found'; return; }
    const hash = await hashPw(p);
    if (hash !== rec.passwordHash){ $('login-msg').innerText = 'Incorrect password'; return; }
    // login success
    currentUser = u;
    localStorage.setItem('streak_user', currentUser);
    $('login-msg').innerText = '';
    startApp(rec);
  };
}

/* ---------------- App functions: tasks, streaks, leaderboard ---------------- */
async function startApp(userRec){
  hide($('auth')); hide($('gate')); hide($('admin'));
  show($('app'));
  $('user-greet').innerText = `Welcome, ${userRec.username}`;
  $('btn-logout').onclick = ()=>{ localStorage.removeItem('streak_user'); location.reload(); };
  $('btn-add-task').onclick = addTask;
  $('btn-refresh').onclick = refreshAll;
  refreshAll();
}

async function addTask(){
  const name = $('task-name').value.trim();
  if (!name) return;
  const task = { user: currentUser, name, streak:0, last:'', created:Date.now() };
  await IDB.addTask(task);
  $('task-name').value = '';
  refreshAll();
}

async function markDone(task){
  const today = new Date().toLocaleDateString();
  if (task.last === today) return;
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString();
  if (task.last === yesterday) task.streak = (task.streak||0) + 1;
  else task.streak = 1;
  task.last = today;
  await IDB.updateTask(task);
  // award XP locally
  const user = await IDB.getUser(currentUser);
  user.xp = (user.xp||0) + 10 + (task.streak * 2);
  await IDB.putUser(user);
  refreshAll();
}

async function deleteTask(id){
  await IDB.deleteTask(id);
  refreshAll();
}

async function refreshAll(){
  if (!currentUser) return;
  const tasks = await IDB.getTasksByUser(currentUser);
  const tdiv = $('tasks'); tdiv.innerHTML = '';
  tasks.sort((a,b)=> b.streak - a.streak);
  tasks.forEach(t=>{
    const el = document.createElement('div'); el.className = 'task';
    el.innerHTML = `<div>
        <strong>${t.name}</strong>
        <div style="color:var(--muted);font-size:12px">Last: ${t.last || 'never'}</div>
      </div>
      <div>
        <span class="fire">🔥 ${t.streak||0}</span>
        <div style="margin-top:8px">
          <button class="mark">Mark</button>
          <button class="del">Delete</button>
        </div>
      </div>`;
    tdiv.appendChild(el);
    el.querySelector('.mark').onclick = ()=> markDone(t);
    el.querySelector('.del').onclick = ()=> { if(confirm('Delete?')) deleteTask(t.id); };
  });

  // leaderboard from users
  const ulist = await IDB.getAllUsers();
  ulist.sort((a,b)=> (b.xp||0) - (a.xp||0));
  $('leaderboard').innerHTML = ulist.slice(0,8).map(u=>`<p><strong>${u.username}</strong> — XP: ${u.xp||0}</p>`).join('');
}

/* ---------------- Bootstrap on load ---------------- */
(async ()=>{
  // auto-try token in URL/hash
  tokensList = await loadHostedTokens();
  renderTokenList();
  // if hash token present, validate and proceed
  if (location.hash && location.hash.includes('token=')){
    const ok = await tryValidateFromURLorInput();
    if (ok) proceedToAuth();
  }

  // admin quick access: "Admin" button shows admin login
  $('btn-skip').onclick = ()=> { hide($('gate')); show($('admin')); };
})();
