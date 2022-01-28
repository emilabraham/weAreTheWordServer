export enum Phase {
    WAIT ="wait",
    CLUE ="clue",
    ELIMINATE ="eliminate",
    GUESS ="guess",
    JUDGE ="judge",
    END ="end"
}

export interface ClueArray {
    [player: string]: Clue;
}

export interface PastWordsArray {
    [word: string]: boolean;
}

export interface PlayerArray {
    [name: string]: Player;
}

export type Clue = {
    clue: string | null | boolean,// Look into this. Why is this allowed to be a boolean?
    visible: boolean
}

export type Player = {
    id: number;
    status: "connected" | "disconnected";
}