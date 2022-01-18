const words = require("./beta.json")["words"];
import { ClueArray, Phase } from "./types"

function randRange(min: number, max: number) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function equivalent(s1: string | null, s2: string | null) {
  if (!s1 || !s2) return false;
  return s1.trim().toLowerCase() === s2.trim().toLowerCase();
}

class Room {
  io: any; //TODO Can I even type this?
  roomName: string;
  roundId: number;
  correct: number; 
  wrong: number;
  activePlayer: string | undefined;
  clues: ClueArray;
  guess: string | undefined;
  judgment: any | undefined; //TODO type this
  pastWords: any; //TODO type this
  phase: Phase;
  playerOrder: any[]; // TODO type this. I believe it's a string.
  players: any; //TODO type this
  spectators: any; //TODO type this
  word: string;

  constructor(io: any, roomName: any) {
    this.io = io;
    this.roomName = roomName;
    
    this.roundId = 0;
    this.correct = 0;
    this.wrong = 0;

    this.activePlayer = undefined;
    this.clues = {}; // player -> {clue, visible}
    this.guess = undefined;
    this.judgment = undefined;
    this.pastWords = {}; // word -> true
    this.phase = Phase.WAIT;
    this.playerOrder = [];
    this.players = {}; // of name => {id, status}
    this.spectators = [];
    this.word = "";
  }

  // players

  sendPlayers() {
    this.io.to(this.roomName).emit("players", this.players, this.playerOrder, this.spectators);
  }

  //TODO I think socketId might be a string?
  newPlayer(name: string, socketId: any) {
    let oldId = undefined;
    if (name in this.players) {
      oldId = this.players[name].id;
      this.io.to(oldId).emit("phase", "disconnected", null);
    } else {
      this.playerOrder.splice(randRange(0, this.playerOrder.length + 1), 0, name);
      this.clues[name] = { clue: null, visible: true };
    }

    this.players[name] = {
      id: socketId,
      status: "connected",
    };
    this.sendPlayers();
    this.sendClues();

    return oldId;
  }

  //TODO I think socketId might be a string?
  addSpectator(socketId: any) {
    this.spectators.push(socketId);
    this.sendPlayers();
  }

  //TODO I think socketId might be a string?
  disconnectSocket(name: string, socketId: any) {
    if (name in this.players && this.players[name].id === socketId) {
      this.players[name].status = "disconnected";
      this.sendPlayers();
      return true;
    } else {
      this.spectators = this.spectators.filter((id: any) => id !== socketId);
      this.sendPlayers();
      return false;
    }
  }

  kickPlayer(name: string) {
    if (!(name in this.players)) return false;
    
    this.io.to(this.players[name].id).emit("phase", "disconnected");
    if (name === this.activePlayer) this.startPhase(Phase.CLUE, undefined);
    this.playerOrder = this.playerOrder.filter(name_ => name_ !== name);
    this.handleClue(undefined, undefined);
    delete this.players[name];
    this.sendPlayers();
    return true;
  }

  closeRoom() {
    let ids = [];
    for (let name in this.players) {
      ids.push(this.players[name].id);
      this.kickPlayer(name);
    }
    //TODO I think id might be a string?
    this.spectators.map((id: any) => {
      ids.push(id);
      this.io.to(id).emit("phase", "disconnected")
    });
    return ids;
  }

  // game

  //TODO type this
  toActive(event: any, data: any) {
    if (this.activePlayer && this.activePlayer in this.players) {
      this.io.to(this.players[this.activePlayer].id).emit(event, data);
    }
  }

  //TODO type this
  toInactive(event: any, data: any) {
    this.playerOrder.map(name => {
      if (name !== this.activePlayer) {
        this.io.to(this.players[name].id).emit(event, data);
      }
    });
    //TODO I think id might be a string?
    this.spectators.map((id: any) => {
      this.io.to(id).emit(event, data);
    })
  }

  blindClues(): ClueArray {
    return Object.fromEntries(
      Object.entries(this.clues).map(([name, {clue, visible}]) =>
        [name, {clue: Boolean(clue), visible: visible}]
      )
    );
  }

  hiddenClues(): ClueArray {
    return Object.fromEntries(
      Object.entries(this.clues).map(([name, {clue, visible}]) =>
        [name, {clue: visible && clue, visible: visible}]
      )
    );
  }

  sendClues() {
    const { phase } = this;
    if (phase === Phase.CLUE) {
      this.io.to(this.roomName).emit("clues", this.blindClues());
    } else if (phase === Phase.ELIMINATE) {
      this.toActive("clues", this.blindClues());
      this.toInactive("clues", this.clues);
    } else if (phase === Phase.GUESS || phase === Phase.JUDGE || phase === Phase.END) {
      this.toActive("clues", this.hiddenClues());
      this.toInactive("clues", this.clues);
    }
  }

  sendWord() {
    this.toActive("word", "");
    this.toInactive("word", this.word);
  }

  sendGuess() {
    this.io.to(this.roomName).emit("guess", this.guess);
  }

  sendJudgment() {
    this.io.to(this.roomName).emit("judgment", this.judgment);
  }

  sendPhase() {
    this.io.to(this.roomName).emit("phase", this.phase, this.roundId, this.activePlayer);
  }

  sendScore() {
    this.io.to(this.roomName).emit("score", this.correct, this.wrong);
  }

  //TODO type this
  sendState(name: string, socket: any) {
    const { phase } = this;
    socket.emit("phase", phase, this.roundId, this.activePlayer);
    socket.emit("score", this.correct, this.wrong);
    if (phase === Phase.WAIT) return;
    let clues = this.clues;
    if (phase === Phase.CLUE) {
      clues = this.blindClues();
      if (name in this.clues && this.clues[name].clue) socket.emit("myClue", this.clues[name].clue);
    }
    if (name === this.activePlayer) {
      if (phase === Phase.ELIMINATE) {
        clues = this.blindClues();
      } else if (phase === Phase.GUESS || phase === Phase.JUDGE || phase === Phase.END) {
        clues = this.hiddenClues();
      }
      socket.emit("word", "");
    } else {
      socket.emit("word", this.word);
    }
    socket.emit("clues", clues);
    if (phase === Phase.JUDGE || phase === Phase.END) {
      socket.emit("guess", this.guess);
    }
    if (phase === Phase.END) socket.emit("judgment", this.judgment);
  }

  handleClue(name: any, clue: any) {
    if (this.phase !== Phase.CLUE) return;
    if (name in this.clues) this.clues[name].clue = clue;
    this.sendClues();
    if (this.playerOrder.filter((name_) => {
      return (name_ !== this.activePlayer) && !this.clues[name_].clue;
    }).length === 0) {
      this.startPhase(Phase.ELIMINATE, undefined);
    }
  }

  toggleClue(name: string) {
    this.clues[name].visible = !this.clues[name].visible;
    this.sendClues();
  }

  handleGuess(guess: string) {
    if (this.phase === Phase.GUESS) {
      this.guess = guess;
      this.sendGuess();
      this.startPhase(Phase.JUDGE, undefined);
      if (equivalent(guess, this.word)) this.handleJudge(true);
    }
  }

  //TODO type this
  handleJudge(judgment: any) {
    if (this.phase === Phase.JUDGE) {
      this.judgment = judgment;
      judgment ? this.correct += 1 : this.wrong += 1;
      this.sendJudgment();
      this.sendScore();
      this.startPhase(Phase.END, undefined);
    }
  }

  //TODO type this
  softStartPhase(phase: any, id_: any) {
    if (phase === Phase.CLUE && this.phase !== Phase.WAIT && this.phase !== Phase.END) return;
    this.startPhase(phase, id_);
  }

  startPhase(phase: Phase, id_: any) {
    if (phase !== Phase.CLUE && this.phase === phase) return;
    if (id_ && this.roundId !== id_) return;
    this.phase = phase;

    if (phase === Phase.CLUE) {
      if (this.activePlayer) {
        // reveal everything from previous round
        this.toActive("word", this.word);
        this.toActive("clues", this.clues);
        this.roundId++;

        const ind = this.playerOrder.indexOf(this.activePlayer);
        this.activePlayer = this.playerOrder[(ind + 1) % this.playerOrder.length];
      } else {
        this.activePlayer = this.playerOrder[0];
      }
      this.playerOrder.map(name => {
        this.clues[name] = { clue: null, visible: true };
      });
      this.io.to(this.roomName).emit("myClue", null);
      do {
        this.word = words[randRange(0, words.length)];
      } while (this.pastWords.hasOwnProperty(this.word));
      this.pastWords[this.word] = true;
      this.sendPhase();
      this.sendClues();
      this.sendWord();
    } else if (phase === Phase.ELIMINATE) {
      this.playerOrder.map(name => {
        const clue = this.clues[name].clue;
        if (!clue) return;
        if (this.playerOrder.filter(name_ => equivalent(clue as string, this.clues[name_].clue as string)).length > 1) {
          this.toggleClue(name);
        }
      });
      this.sendPhase();
      this.sendClues();
    } else if (phase === Phase.GUESS) {
      this.sendPhase();
      this.sendClues();
    }
    else {
      this.sendPhase();
    }
  }
}

module.exports = Room;
