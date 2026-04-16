import { MatchmakingQueue } from "../core/MatchmakingQueue.js";

export class QueueRegistry {
  private readonly waitingRooms = new MatchmakingQueue<string>();

  updateRoom(roomId: string, waitingPlayers: number) {
    if (waitingPlayers === 1) {
      this.waitingRooms.enqueue(roomId);
      return;
    }

    this.waitingRooms.remove(roomId);
  }

  removeRoom(roomId: string) {
    this.waitingRooms.remove(roomId);
  }

  getPosition(roomId: string) {
    return this.waitingRooms.positionOf(roomId) ?? 1;
  }

  getQueuedPlayers() {
    return this.waitingRooms.size();
  }
}

export const queueRegistry = new QueueRegistry();
