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
  {
    platforms: [
      { x: 0, y: 540, w: 2000, h: 60 },

      { x: 150, y: 500, w: 120, h: 20 },

      // 🔥 móviles
      { x: 350, y: 460, w: 120, h: 20, moveX: 100, speed: 1, dir: 1 },
      { x: 550, y: 400, w: 120, h: 20, moveX: 150, speed: 1.2, dir: -1 },

      { x: 800, y: 350, w: 200, h: 20 },
    ],
    key: { x: 850, y: 310 },
    door: { x: 1100, y: 480 },
  },

  {
    platforms: [
      { x: 0, y: 540, w: 2000, h: 60 },
      { x: 300, y: 500, w: 120, h: 20 },
      { x: 500, y: 430, w: 120, h: 20 },
      { x: 700, y: 360, w: 120, h: 20 },
      { x: 950, y: 260, w: 200, h: 20 },
    ],
    key: { x: 980, y: 220 },
    door: { x: 1200, y: 480 },
  },

  {
    platforms: [
      { x: 0, y: 540, w: 2000, h: 60 },
      { x: 400, y: 450, w: 200, h: 20 },
      { x: 700, y: 350, w: 200, h: 20 },
    ],
    key: { x: 100, y: 500 },
    door: { x: 750, y: 310 },
  },
];

// 🔌 CONEXIÓN
io.on("connection", (socket) => {
  if (Object.keys(players).length >= MAX_PLAYERS) {
    socket.disconnect();
    return;
  }

  console.log("Jugador conectado:", socket.id);

  players[socket.id] = {
    x: 100 + Object.keys(players).length * 60,
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

    color: colors[Object.keys(players).length % colors.length],
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

// 🧠 UPDATE
function update() {
  const current = levels[level];

  // 🔄 mover plataformas
  for (let plat of current.platforms) {
    if (plat.moveX) {
      if (!plat.baseX) plat.baseX = plat.x;

      plat.x += plat.speed * plat.dir;

      if (plat.x > plat.baseX + plat.moveX || plat.x < plat.baseX) {
        plat.dir *= -1;
      }
    }
  }

  for (let id in players) {
    let p = players[id];
    let input = inputs[id] || {};

    // movimiento
    if (input.left) p.vx -= p.speed;
    if (input.right) p.vx += p.speed;

    if (p.vx > p.maxSpeed) p.vx = p.maxSpeed;
    if (p.vx < -p.maxSpeed) p.vx = -p.maxSpeed;

    if (!input.left && !input.right) {
      p.vx *= p.friction;
    }

    // gravedad
    p.vy += p.gravity;

    // salto
    if (input.jump && p.onGround) {
      p.vy = p.jumpPower;
      p.onGround = false;
    }

    if (!input.jump && p.vy < -3) {
      p.vy *= 0.5;
    }

    p.x += p.vx;
    p.y += p.vy;

    p.onGround = false;

    // plataformas
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

        // 🔥 seguir plataforma
        if (plat.moveX) {
          p.x += plat.speed * plat.dir;
        }
      }
    }

    // 👥 jugadores
    for (let oid in players) {
      if (oid === id) continue;
      let o = players[oid];

      // subir
      if (
        p.x < o.x + o.w &&
        p.x + p.w > o.x &&
        p.y + p.h > o.y &&
        p.y + p.h < o.y + 20 &&
        p.vy >= 0
      ) {
        p.y = o.y - p.h;
        p.vy = 0;
        p.onGround = true;
      }

      // empujar
      if (p.x < o.x + o.w && p.x + p.w > o.x && Math.abs(p.y - o.y) < 30) {
        if (p.vx > 0) o.x += 2;
        if (p.vx < 0) o.x -= 2;
      }
    }

    // llave
    if (
      Math.abs(p.x - current.key.x) < 40 &&
      Math.abs(p.y - current.key.y) < 40
    ) {
      p.hasKey = true;
    }
  }

  // puerta
  let allInDoor = true;

  for (let id in players) {
    let p = players[id];

    if (
      !p.hasKey ||
      Math.abs(p.x - current.door.x) > 60 ||
      Math.abs(p.y - current.door.y) > 60
    ) {
      allInDoor = false;
    }
  }

  if (allInDoor && Object.keys(players).length > 0) {
    level++;
    if (level >= levels.length) level = 0;

    for (let id in players) {
      players[id].x = 100;
      players[id].y = 500;
      players[id].vx = 0;
      players[id].vy = 0;
      players[id].hasKey = false;
    }
  }

  io.emit("update", {
    players,
    key: current.key,
    door: current.door,
    platforms: current.platforms,
    level: level + 1,
  });
}

setInterval(update, 1000 / 30);

server.listen(3000, () => {
  console.log("Host en http://localhost:3000");
});
