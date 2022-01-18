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
export type Clue = {
    clue: string | null | boolean,// Look into this. Why is this allowed to be a boolean?
    visible: boolean
}