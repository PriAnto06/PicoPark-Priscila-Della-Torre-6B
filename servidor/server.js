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
const colors = ["red","blue","green","purple","orange","pink","cyan"];

let level = 0;

// 🎮 NIVELES
let levels = [
  {
    platforms: [
      { x: 0, y: 540, w: 2000, h: 60 },
      { x: 300, y: 400, w: 200, h: 20 },
      { x: 600, y: 300, w: 200, h: 20 },
    ],
    key: { x: 650, y: 260 },
    door: { x: 1000, y: 470 },
  },
  {
    platforms: [
      { x: 0, y: 540, w: 2000, h: 60 },
      { x: 200, y: 450, w: 150, h: 20 },
      { x: 400, y: 350, w: 150, h: 20 },
      { x: 650, y: 250, w: 150, h: 20 },
    ],
    key: { x: 700, y: 210 },
    door: { x: 1100, y: 470 },
  },
  {
    platforms: [
      { x: 0, y: 540, w: 2000, h: 60 },
      { x: 500, y: 400, w: 200, h: 20 },
    ],
    key: { x: 520, y: 360 },
    door: { x: 1200, y: 470 },
  },
];

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
    vy: 0,
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

// colisión plataformas
function collide(p, plat) {
  return (
    p.x < plat.x + plat.w &&
    p.x + p.w > plat.x &&
    p.y + p.h < plat.y + 10 &&
    p.y + p.h + p.vy >= plat.y
  );
}

function update() {
  const current = levels[level];

  for (let id in players) {
    let p = players[id];
    let input = inputs[id] || {};

    if (input.left) p.x -= 4;
    if (input.right) p.x += 4;

    p.vy += 0.5;
    p.y += p.vy;

    let onGround = false;

    // plataformas
    for (let plat of current.platforms) {
      if (collide(p, plat)) {
        p.y = plat.y - p.h;
        p.vy = 0;
        onGround = true;
      }
    }

    // 👥 subirse a otros
    for (let oid in players) {
      if (oid === id) continue;
      let o = players[oid];

      if (
        p.x < o.x + o.w &&
        p.x + p.w > o.x &&
        p.y + p.h < o.y + 10 &&
        p.y + p.h + p.vy >= o.y
      ) {
        p.y = o.y - p.h;
        p.vy = 0;
        onGround = true;
      }
    }

    if (input.jump && onGround) {
      p.vy = -10;
    }

    // llave
    if (
      Math.abs(p.x - current.key.x) < 40 &&
      Math.abs(p.y - current.key.y) < 40
    ) {
      p.hasKey = true;
    }
  }

  // 🚪 TODOS deben estar en puerta
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