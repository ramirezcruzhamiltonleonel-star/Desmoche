import type { StakeType } from "@desmoche/shared";
import { GameError } from "../game/errors";
import { generateTableCode, Room } from "./room";

export class RoomManager {
  private readonly rooms = new Map<string, Room>();

  createRoom(stakeType: StakeType, ante: number): Room {
    let code = generateTableCode();
    while (this.rooms.has(code)) {
      code = generateTableCode();
    }
    const room = new Room(code, stakeType, ante);
    this.rooms.set(code, room);
    return room;
  }

  getRoom(code: string): Room {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) throw new GameError("No existe una mesa con ese código");
    return room;
  }
}
