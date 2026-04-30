const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server);

let players = {};
let inputs = {};

const MAX_PLAYERS = 7;
const colors = ["red", "blue", "green", "purple", "orange", "pink", "cyan"];

let level = 0;

// 🎮 NIVELES
let levels = [
  // 🌤 NIVEL 1
  {
    theme: {
      bg: "#87CEEB",
      ground: "#654321",
    },

    platforms: [
      { x: 0, y: 540, w: 2000, h: 60 },
      { x: 200, y: 500, w: 120, h: 20 },
      { x: 400, y: 450, w: 120, h: 20 },
      { x: 600, y: 400, w: 120, h: 20 },
    ],

    key: { x: 650, y: 360 },

    door: {
      x: 900,
      y: 470,
      unlocked: false,
    },
  },

  // 🌙 NIVEL 2
  {
    theme: {
      bg: "#0b1026",
      ground: "#7CFC90",
    },

    platforms: [
      { x: 0, y: 540, w: 2000, h: 60 },

      { x: 150, y: 500, w: 100, h: 20 },
      { x: 300, y: 450, w: 100, h: 20 },
      { x: 450, y: 400, w: 100, h: 20 },

      { x: 650, y: 350, w: 120, h: 20, moveX: 150, speed: 1.8, dir: 1 },

      { x: 900, y: 300, w: 120, h: 20 },
    ],

    key: { x: 950, y: 260 },

    door: {
      x: 1200,
      y: 470,
      unlocked: false,
    },
  },
];

// 🔌 conexión
io.on("connection", (socket) => {
  if (Object.keys(players).length >= MAX_PLAYERS) {
    socket.disconnect();
    return;
  }

  players[socket.id] = {
    x: 100,
    y: 500,
    w: 40,
    h: 40,

    vx: 0,
    vy: 0,

    speed: 0.6,
    maxSpeed: 4,
    friction: 0.8,
    gravity: 0.6,
    jumpPower: -12,

    onGround: false,

    color: colors[Math.floor(Math.random() * colors.length)],
    hasKey: false,
  };

  inputs[socket.id] = {};

  socket.on("input", (data) => {
    inputs[socket.id] = data;
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
    delete inputs[socket.id];
  });
});

// 🧠 update
function update() {
  const current = levels[level] || levels[0];

  // 🔄 plataformas móviles
  for (let plat of current.platforms) {
    if (plat.moveX) {
      if (!plat.baseX) plat.baseX = plat.x;

      plat.x += plat.speed * plat.dir;

      if (plat.x > plat.baseX + plat.moveX || plat.x < plat.baseX) {
        plat.dir *= -1;
      }
    }
  }

  // 👥 jugadores
  for (let id in players) {
    let p = players[id];
    let input = inputs[id] || {};

    if (input.left) p.vx -= p.speed;
    if (input.right) p.vx += p.speed;

    if (p.vx > p.maxSpeed) p.vx = p.maxSpeed;
    if (p.vx < -p.maxSpeed) p.vx = -p.maxSpeed;

    if (!input.left && !input.right) p.vx *= p.friction;

    p.vy += p.gravity;

    if (input.jump && p.onGround) {
      p.vy = p.jumpPower;
      p.onGround = false;
    }

    p.x += p.vx;
    p.y += p.vy;

    p.onGround = false;

    // 🟩 plataformas
    for (let plat of current.platforms) {
      if (
        p.x < plat.x + plat.w &&
        p.x + p.w > plat.x &&
        p.y + p.h > plat.y &&
        p.y + p.h < plat.y + 20 &&
        p.vy >= 0
      ) {
        p.y = plat.y - p.h;
        p.vy = 0;
        p.onGround = true;

        if (plat.moveX) {
          p.x += plat.speed * plat.dir;
        }
      }
    }

    // 🔑 llave
    if (
      Math.abs(p.x - current.key.x) < 40 &&
      Math.abs(p.y - current.key.y) < 40
    ) {
      p.hasKey = true;
    }

    // 🚪 activar puerta cuando tiene llave
    if (p.hasKey) {
      current.door.unlocked = true;
    }

    // 🚪 pasar nivel
    if (
      p.hasKey &&
      current.door.unlocked &&
      Math.abs(p.x - current.door.x) < 60 &&
      Math.abs(p.y - current.door.y) < 60
    ) {
      level++;

      if (level >= levels.length) level = 0;

      for (let pid in players) {
        players[pid].x = 100;
        players[pid].y = 500;
        players[pid].vx = 0;
        players[pid].vy = 0;
        players[pid].hasKey = false;
      }
    }
  }

  // 📡 enviar
  io.emit("update", {
    players,
    key: current.key,
    door: current.door,
    platforms: current.platforms,
    level: level + 1,
    theme: current.theme,
  });
}

setInterval(update, 1000 / 30);

server.listen(3000, () => {
  console.log("Servidor listo http://localhost:3000");
});
