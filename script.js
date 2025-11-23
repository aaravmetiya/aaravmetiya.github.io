let users = JSON.parse(localStorage.getItem("users")) || {};
let currentUser = null;

function login() {
  const name = document.getElementById("username").value.trim();
  if (!name) return;

  if (!users[name]) users[name] = [];
  currentUser = name;

  localStorage.setItem("users", JSON.stringify(users));

  document.getElementById("login-screen").classList.add("hidden");
  document.getElementById("main-screen").classList.remove("hidden");
  document.getElementById("welcome").innerText = `👋 Welcome, ${name}!`;

  render();
}

function logout() {
  currentUser = null;
  document.getElementById("main-screen").classList.add("hidden");
  document.getElementById("login-screen").classList.remove("hidden");
}

function save() {
  localStorage.setItem("users", JSON.stringify(users));
  render();
}

function addTask() {
  const task = document.getElementById("taskInput").value.trim();
  if (!task || !currentUser) return;

  users[currentUser].push({
    name: task,
    streak: 0,
    last: ""
  });

  save();
}

function updateStreak(i) {
  const today = new Date().toLocaleDateString();
  const task = users[currentUser][i];

  if (task.last !== today) {
    task.streak++;
    task.last = today;
  }

  save();
}

function render() {
  const taskList = document.getElementById("taskList");
  taskList.innerHTML = "";

  users[currentUser].forEach((t, i) => {
    taskList.innerHTML += `
      <div class="task">
        <h3>${t.name}</h3>
        <p>🔥 <span class="fire">${t.streak}</span> day streak</p>
        <button onclick="updateStreak(${i})">Mark Done</button>
      </div>
    `;
  });
}

if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("service-worker.js");
