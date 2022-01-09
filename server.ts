import express from "express";
import path from "path";
const app = express();

const reactPath = path.resolve(__dirname, "..", "client", "build");
app.use(express.static(reactPath));

app.get("*", (req: any, res: any) => {
  res.sendFile(path.join(reactPath, "index.html"));
});

const http = require("http").createServer(app);
const io = require("socket.io")(http);

let clients: any = {};
let rooms: any = {};

function kickAndClean(roomName: any) {
  if (!rooms[roomName]) return;
  if (rooms[roomName].players === 1) {
    const ids: any[] = rooms[roomName].room.closeRoom();
    ids.map((id) => {
      if (id in clients) clients[id].leave(roomName);
    });
    delete rooms[roomName];
  } else {
    rooms[roomName].players -= 1;
  }
}

io.on("connection", (socket: any) => {
  clients[socket.id] = socket;

  let name: any = undefined;
  let roomName: any = undefined;
  let room: any = undefined;

  socket.on("join", (roomName_: any) => {
    roomName = roomName_;
    socket.join(roomName);
    if (roomName in rooms) {
      room = rooms[roomName].room;
    } else {
      room = "temp";
      // room = new Room(io, roomName);
      rooms[roomName] = { room: room, players: 0 };
    }
  });
  socket.on("leave", (roomName_: any) => {
    if (roomName_ in rooms && rooms[roomName_].room.kickPlayer(name)) {
      kickAndClean(roomName_);
    }
    socket.leave(roomName_);
    roomName = undefined;
  });

  socket.on("name", (name_: any) => {
    if (room === undefined) return;
    name = name_;
    const oldId = room.newPlayer(name, socket.id);
    if (oldId in clients) {
      clients[oldId].leave(roomName);
      rooms[roomName].players -= 1;
    }
    room.sendState(name, socket);
    rooms[roomName].players += 1;

  });
  socket.on("spectator", () => {
    room && room.addSpectator(socket.id);
    room && room.sendState(null, socket);
  });
  socket.on("disconnect", () => {
    if (socket.id in clients) delete clients[socket.id];
    if (room && room.disconnectSocket(name, socket.id)) kickAndClean(roomName);
  });
  socket.on("kick", (name_: any, id_: any) => {
    if (id_ in clients) clients[id_].leave(roomName);
    if (room && room.kickPlayer(name_)) kickAndClean(roomName);
  });

  socket.on("softPhase", (phase: any, id_: any) => room && room.softStartPhase(phase, id_));
  socket.on("phase", (phase: any, id_: any) => room && room.startPhase(phase, id_));
  socket.on("clue", (clue: any) => {
    socket.emit("myClue", clue);
    room && room.handleClue(name, clue);
  });
  socket.on("toggle", (name_: any) => room && room.toggleClue(name_));
  socket.on("guess", (guess: any) => room && room.handleGuess(guess));
  socket.on("judge", (judgement: any) => room && room.handleJudge(judgement));
});

const port = process.env.PORT || 4001;

http.listen(port, () => {
  console.log(`listening on port ${port}`);
});
