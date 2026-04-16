const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
app.use(express.static("public"));

const server = http.createServer(app);
const io = new Server(server);

let players = {};

io.on("connection", (socket) => {
  console.log("Conectado:", socket.id);

  players[socket.id] = {
    x: 100,
    y: 300,
    color: "red",
  };

  // 👇 detectar lo que manda el celular
  socket.onAny((event, data) => {
    console.log("EVENTO:", event);
    console.log("DATA:", data);

    const p = players[socket.id];
    if (!p) return;

    if (data === "LEFT" || data === "left") p.x -= 10;
    if (data === "RIGHT" || data === "right") p.x += 10;
    if (data === "UP" || data === "up") p.y -= 10;
    if (data === "DOWN" || data === "down") p.y += 10;
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
  });
});

setInterval(() => {
  io.emit("update", players);
}, 1000 / 30);

server.listen(3000, () => {
  console.log("Host en http://localhost:3000");
});