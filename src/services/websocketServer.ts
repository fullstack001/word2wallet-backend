import WebSocket, { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { IncomingMessage } from "http";
import { Auction } from "../models/Auction";
import { Bid } from "../models/Bid";
import { Offer } from "../models/Offer";
import { JWTPayload, WSMessage } from "../types";

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  auctionId?: string;
  isAlive?: boolean;
}

interface AuctionRoom {
  auctionId: string;
  connections: Set<AuthenticatedWebSocket>;
  lastSnapshot?: any;
}

class WebSocketManager {
  private wss: WebSocketServer;
  private auctionRooms: Map<string, AuctionRoom> = new Map();
  private heartbeatInterval: NodeJS.Timeout | undefined;

  constructor(server: any) {
    this.wss = new WebSocketServer({
      server,
      path: "/ws",
      verifyClient: this.verifyClient.bind(this),
    });

    console.log("WebSocket server initialized on path /ws");

    this.setupEventHandlers();
    this.startHeartbeat();
    this.startAuctionUpdates();
  }

  private verifyClient(info: {
    origin: string;
    secure: boolean;
    req: IncomingMessage;
  }): boolean {
    console.log("WebSocket verifyClient called:", {
      origin: info.origin,
      secure: info.secure,
      url: info.req.url,
    });

    const url = new URL(info.req.url!, `http://${info.req.headers.host}`);
    const auctionId = url.searchParams.get("auctionId");

    if (!auctionId) {
      console.log("WebSocket connection rejected: No auctionId provided");
      return false;
    }

    console.log("WebSocket connection approved for auctionId:", auctionId);
    return true;
  }

  private setupEventHandlers(): void {
    this.wss.on(
      "connection",
      (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
        console.log("New WebSocket connection received");
        this.handleConnection(ws, req);
      }
    );

    this.wss.on("error", (error: Error) => {
      console.error("WebSocket server error:", error);
    });
  }

  private async handleConnection(
    ws: AuthenticatedWebSocket,
    req: IncomingMessage
  ): Promise<void> {
    try {
      console.log(
        "WebSocket connection attempt from:",
        req.headers.origin || "unknown"
      );
      console.log("Request URL:", req.url);

      // Extract auction ID from URL
      const url = new URL(req.url!, `http://${req.headers.host}`);
      const auctionId = url.searchParams.get("auctionId");

      console.log("Extracted auctionId:", auctionId);

      if (!auctionId) {
        console.log("WebSocket connection rejected: No auction ID provided");
        (ws as any).close(1008, "No auction ID provided");
        return;
      }

      // Verify auction exists
      const auction = await Auction.findById(auctionId);
      if (!auction) {
        console.log(
          "WebSocket connection rejected: Auction not found for ID:",
          auctionId
        );
        (ws as any).close(1008, "Auction not found");
        return;
      }

      console.log("Auction found:", auction.title);

      // Authenticate user if token is provided
      const token = this.extractToken(req);
      if (token) {
        try {
          const payload = jwt.verify(
            token,
            process.env.JWT_SECRET!
          ) as JWTPayload;
          ws.userId = payload.userId;
        } catch (error) {
          console.log("WebSocket authentication failed:", error);
          // Continue without authentication for public access
        }
      }

      ws.auctionId = auctionId;
      ws.isAlive = true;

      // Add to auction room
      this.addToAuctionRoom(auctionId, ws);

      // Send initial snapshot
      const snapshot = await this.getAuctionSnapshot(auctionId);
      this.sendMessage(ws, {
        type: "snapshot",
        data: snapshot,
        auctionId: auctionId,
      });

      // Set up message handlers
      (ws as any).on("message", (data: WebSocket.Data) => {
        this.handleMessage(ws, data);
      });

      (ws as any).on("pong", () => {
        ws.isAlive = true;
      });

      (ws as any).on("close", (code: number, reason: string) => {
        console.log(`WebSocket closed for auction ${auctionId}:`, {
          code,
          reason,
        });
        this.removeFromAuctionRoom(auctionId, ws);
      });

      (ws as any).on("error", (error: Error) => {
        console.error(`WebSocket error for auction ${auctionId}:`, error);
        this.removeFromAuctionRoom(auctionId, ws);
      });

      console.log(
        `WebSocket connected for auction ${auctionId}, user ${
          ws.userId || "anonymous"
        }`
      );
    } catch (error) {
      console.error("Error handling WebSocket connection:", error);
      (ws as any).close(1011, "Internal server error");
    }
  }

  private extractToken(req: IncomingMessage): string | null {
    // Try to get token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }

    // Try to get token from query parameter
    const url = new URL(req.url!, `http://${req.headers.host}`);
    return url.searchParams.get("token");
  }

  private addToAuctionRoom(
    auctionId: string,
    ws: AuthenticatedWebSocket
  ): void {
    let room = this.auctionRooms.get(auctionId);
    if (!room) {
      room = {
        auctionId,
        connections: new Set(),
      };
      this.auctionRooms.set(auctionId, room);
    }
    room.connections.add(ws);
  }

  private removeFromAuctionRoom(
    auctionId: string,
    ws: AuthenticatedWebSocket
  ): void {
    const room = this.auctionRooms.get(auctionId);
    if (room) {
      room.connections.delete(ws);
      if (room.connections.size === 0) {
        this.auctionRooms.delete(auctionId);
      }
    }
  }

  private async handleMessage(
    ws: AuthenticatedWebSocket,
    data: WebSocket.Data
  ): Promise<void> {
    try {
      const message = JSON.parse(data.toString());

      switch (message.type) {
        case "ping":
          this.sendMessage(ws, {
            type: "pong",
            data: {},
            auctionId: ws.auctionId!,
          });
          break;
        default:
          console.log("Unknown message type:", message.type);
      }
    } catch (error) {
      console.error("Error handling WebSocket message:", error);
    }
  }

  private sendMessage(ws: AuthenticatedWebSocket, message: WSMessage): void {
    if ((ws as any).readyState === WebSocket.OPEN) {
      (ws as any).send(JSON.stringify(message));
    }
  }

  private async getAuctionSnapshot(auctionId: string): Promise<any> {
    const auction = await Auction.findById(auctionId)
      .populate("highBidder", "firstName lastName")
      .lean();

    if (!auction) {
      return null;
    }

    const room = this.auctionRooms.get(auctionId);
    const onlineCount = room ? room.connections.size : 0;

    return {
      id: auction._id,
      title: auction.title,
      currency: auction.currency,
      highBid: auction.currentBid || auction.startingPrice,
      leader: auction.highBidder
        ? {
            id: (auction.highBidder as any)._id,
            name: `${(auction.highBidder as any).firstName} ${
              (auction.highBidder as any).lastName
            }`,
          }
        : null,
      online: onlineCount,
      start: auction.startTime,
      end: auction.endTime,
      reserveMet: auction.reservePrice
        ? (auction.currentBid || auction.startingPrice) >= auction.reservePrice
        : true,
      status: auction.status,
      buyNowPrice: auction.buyNowPrice,
      timeRemaining:
        auction.status === "active"
          ? Math.max(
              0,
              Math.floor((auction.endTime.getTime() - Date.now()) / 1000)
            )
          : 0,
    };
  }

  private async broadcastToAuction(
    auctionId: string,
    message: WSMessage
  ): Promise<void> {
    const room = this.auctionRooms.get(auctionId);
    if (room) {
      const snapshot = await this.getAuctionSnapshot(auctionId);
      const broadcastMessage: WSMessage = {
        type: message.type,
        data: snapshot || message.data,
        auctionId: auctionId,
      };

      room.connections.forEach((ws) => {
        this.sendMessage(ws, broadcastMessage);
      });
    }
  }

  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.wss.clients.forEach((ws: AuthenticatedWebSocket) => {
        if (!ws.isAlive) {
          (ws as any).terminate();
          return;
        }
        ws.isAlive = false;
        (ws as any).ping();
      });
    }, 30000); // 30 seconds
  }

  private startAuctionUpdates(): void {
    // Update auction snapshots every 15 seconds
    setInterval(async () => {
      for (const [auctionId, room] of this.auctionRooms) {
        if (room.connections.size > 0) {
          await this.broadcastToAuction(auctionId, {
            type: "snapshot",
            data: {},
            auctionId: auctionId,
          });
        }
      }
    }, 15000);
  }

  // Public methods for broadcasting updates
  public async broadcastBidUpdate(auctionId: string): Promise<void> {
    await this.broadcastToAuction(auctionId, {
      type: "bid_update",
      data: {},
      auctionId: auctionId,
    });
  }

  public async broadcastOfferUpdate(auctionId: string): Promise<void> {
    await this.broadcastToAuction(auctionId, {
      type: "offer_update",
      data: {},
      auctionId: auctionId,
    });
  }

  public async broadcastAuctionEnd(auctionId: string): Promise<void> {
    await this.broadcastToAuction(auctionId, {
      type: "snapshot",
      data: {},
      auctionId: auctionId,
    });
  }

  public getOnlineCount(auctionId: string): number {
    const room = this.auctionRooms.get(auctionId);
    return room ? room.connections.size : 0;
  }

  public cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.wss.close();
  }
}

export default WebSocketManager;
