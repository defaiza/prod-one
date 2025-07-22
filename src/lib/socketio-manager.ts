import { USER_NAME } from "@/constants";
import { Evt } from "evt";
import { io, type Socket } from "socket.io-client";
import { v4 } from "uuid";

// Socket message types from ElizaOS core
enum SOCKET_MESSAGE_TYPE {
  ROOM_JOINING = 1,
  SEND_MESSAGE = 2,
  MESSAGE = 3,
  ACK = 4,
  THINKING = 5,
  CONTROL = 6,
}

// Direct connection to ElizaOS server for Socket.IO (proxying doesn't work for WebSocket)
const SOCKET_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
console.log("[SocketIO] Using server URL:", SOCKET_URL);

// Enhanced types for ElizaOS Socket.IO events (matching official client)
export type MessageBroadcastData = {
  senderId: string;
  senderName: string;
  text: string;
  channelId: string;
  roomId?: string; // Deprecated - for backward compatibility only
  createdAt: number;
  source: string;
  name: string; // Required for ContentWithUser compatibility
  attachments?: any[];
  thought?: string; // Agent's thought process
  actions?: string[]; // Actions taken by the agent
  prompt?: string; // The LLM prompt used to generate this message
  [key: string]: any;
};

export type MessageCompleteData = {
  channelId: string;
  roomId?: string; // Deprecated - for backward compatibility only
  [key: string]: any;
};

export type ControlMessageData = {
  action: "enable_input" | "disable_input";
  target?: string;
  channelId: string;
  roomId?: string; // Deprecated - for backward compatibility only
  [key: string]: any;
};

export type MessageDeletedData = {
  messageId: string;
  channelId: string;
  roomId?: string; // Deprecated - for backward compatibility only
  [key: string]: any;
};

export type ChannelClearedData = {
  channelId: string;
  roomId?: string; // Deprecated - for backward compatibility only
  [key: string]: any;
};

export type ChannelDeletedData = {
  channelId: string;
  roomId?: string; // Deprecated - for backward compatibility only
  [key: string]: any;
};

export type LogStreamData = {
  level: number;
  time: number;
  msg: string;
  agentId?: string;
  agentName?: string;
  channelId?: string;
  roomId?: string; // Deprecated - for backward compatibility only
  [key: string]: string | number | boolean | null | undefined;
};

// A simple class that provides EventEmitter-like interface using Evt internally
class EventAdapter {
  private events: Record<string, Evt<any>> = {};

  constructor() {
    // Initialize common events
    this.events.messageBroadcast = Evt.create<MessageBroadcastData>();
    this.events.messageComplete = Evt.create<MessageCompleteData>();
    this.events.controlMessage = Evt.create<ControlMessageData>();
    this.events.messageDeleted = Evt.create<MessageDeletedData>();
    this.events.channelCleared = Evt.create<ChannelClearedData>();
    this.events.channelDeleted = Evt.create<ChannelDeletedData>();
    this.events.logStream = Evt.create<LogStreamData>();
  }

  on(eventName: string, listener: (...args: any[]) => void) {
    if (!this.events[eventName]) {
      this.events[eventName] = Evt.create();
    }

    this.events[eventName].attach(listener);
    return this;
  }

  off(eventName: string, listener: (...args: any[]) => void) {
    if (this.events[eventName]) {
      const handlers = this.events[eventName].getHandlers();
      for (const handler of handlers) {
        if (handler.callback === listener) {
          handler.detach();
        }
      }
    }
    return this;
  }

  emit(eventName: string, ...args: any[]) {
    if (this.events[eventName]) {
      this.events[eventName].post(args.length === 1 ? args[0] : args);
    }
    return this;
  }

  once(eventName: string, listener: (...args: any[]) => void) {
    if (!this.events[eventName]) {
      this.events[eventName] = Evt.create();
    }

    this.events[eventName].attachOnce(listener);
    return this;
  }

  // For checking if EventEmitter has listeners
  listenerCount(eventName: string): number {
    if (!this.events[eventName]) return 0;
    return this.events[eventName].getHandlers().length;
  }

  // Used only for internal access to the Evt instances
  _getEvt(eventName: string): Evt<any> | undefined {
    return this.events[eventName];
  }
}

/**
 * SocketIOManager handles real-time communication between the client and server
 * using Socket.io. Based on the official ElizaOS client implementation.
 */
class SocketIOManager extends EventAdapter {
  private static instance: SocketIOManager | null = null;
  private socket: Socket | null = null;
  private isConnected = false;
  private connectPromise: Promise<void> | null = null;
  private resolveConnect: (() => void) | null = null;
  private activeChannels: Set<string> = new Set();
  private activeRooms: Set<string> = new Set(); // For backward compatibility
  private activeSessionChannelId: string | null = null; // Current session for message filtering
  private entityId: string | null = null;
  private serverId: string | null = null;

  // Public accessor for EVT instances (for advanced usage)
  public get evtMessageBroadcast() {
    return this._getEvt("messageBroadcast") as Evt<MessageBroadcastData>;
  }

  public get evtMessageComplete() {
    return this._getEvt("messageComplete") as Evt<MessageCompleteData>;
  }

  public get evtControlMessage() {
    return this._getEvt("controlMessage") as Evt<ControlMessageData>;
  }

  public get evtMessageDeleted() {
    return this._getEvt("messageDeleted") as Evt<MessageDeletedData>;
  }

  public get evtChannelCleared() {
    return this._getEvt("channelCleared") as Evt<ChannelClearedData>;
  }

  public get evtChannelDeleted() {
    return this._getEvt("channelDeleted") as Evt<ChannelDeletedData>;
  }

  public get evtLogStream() {
    return this._getEvt("logStream") as Evt<LogStreamData>;
  }

  private constructor() {
    super();
  }

  public static getInstance(): SocketIOManager {
    if (!SocketIOManager.instance) {
      SocketIOManager.instance = new SocketIOManager();
    }
    return SocketIOManager.instance;
  }

  /**
   * Initialize the Socket.io connection to the server
   * @param entityId The client entity ID
   * @param serverId Server ID for channel-based messaging
   */
  public initialize(entityId: string, serverId?: string): void {
    this.entityId = entityId;
    this.serverId = serverId || null;

    if (this.socket) {
      console.warn("[SocketIO] Socket already initialized");
      return;
    }

    // Create a single socket connection
    console.info("connecting to", SOCKET_URL);
    this.socket = io(SOCKET_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      transports: ["polling", "websocket"], // Try polling first
      forceNew: false,
      upgrade: true,
    });

    // Set up connection promise for async operations that depend on connection
    this.connectPromise = new Promise<void>((resolve) => {
      this.resolveConnect = resolve;
    });

    this.socket.on("connect", () => {
      console.info("[SocketIO] Connected to server successfully");
      console.info("[SocketIO] Socket ID:", this.socket?.id);
      this.isConnected = true;
      this.resolveConnect?.();

      // Rejoin any active channels after reconnection
      this.activeChannels.forEach((channelId) => {
        this.joinChannel(channelId);
      });

      // Rejoin any active rooms after reconnection (backward compatibility)
      this.activeRooms.forEach((roomId) => {
        this.joinRoom(roomId);
      });
    });

    this.socket.on("connection_established", (data) => {
      console.info("[SocketIO] Connection established:", data);
    });

    this.socket.on("messageBroadcast", (data) => {
      console.info(`[SocketIO] Message broadcast received:`, data);

      // Check if this message is for our active session
      const isForActiveSession =
        this.activeSessionChannelId &&
        (data.channelId === this.activeSessionChannelId ||
          data.roomId === this.activeSessionChannelId);

      // Also check if it's for any of our joined channels (for backward compatibility)
      const isActiveChannel =
        data.channelId && this.activeChannels.has(data.channelId);
      const isActiveRoom = data.roomId && this.activeRooms.has(data.roomId);

      if (isForActiveSession || isActiveChannel || isActiveRoom) {
        const context = isForActiveSession
          ? `active session ${this.activeSessionChannelId}`
          : isActiveChannel
            ? `active channel ${data.channelId}`
            : `active room ${data.roomId}`;
        console.info(`[SocketIO] Handling message for ${context}`);

        // Post the message to the event
        this.emit("messageBroadcast", {
          ...data,
          name: data.senderName, // Required for ContentWithUser compatibility
        });
      } else {
        console.warn(
          `[SocketIO] Received message for inactive session/channel/room:`,
          {
            channelId: data.channelId,
            roomId: data.roomId,
            activeSession: this.activeSessionChannelId,
          },
          "Active channels:",
          Array.from(this.activeChannels),
          "Active rooms:",
          Array.from(this.activeRooms),
        );
      }
    });

    this.socket.on("messageComplete", (data) => {
      console.info(`[SocketIO] Message complete received:`, data);
      this.emit("messageComplete", data);
    });

    this.socket.on("controlMessage", (data) => {
      console.info(`[SocketIO] Control message received:`, data);

      const isActiveChannel =
        data.channelId && this.activeChannels.has(data.channelId);
      const isActiveRoom = data.roomId && this.activeRooms.has(data.roomId);

      if (isActiveChannel || isActiveRoom) {
        const context = isActiveChannel
          ? `channel ${data.channelId}`
          : `room ${data.roomId}`;
        console.info(
          `[SocketIO] Handling control message for active ${context}`,
        );
        this.emit("controlMessage", data);
      } else {
        console.warn(
          `[SocketIO] Received control message for inactive channel/room:`,
          { channelId: data.channelId, roomId: data.roomId },
        );
      }
    });

    this.socket.on("messageDeleted", (data) => {
      console.info(`[SocketIO] Message deleted:`, data);
      this.emit("messageDeleted", data);
    });

    this.socket.on("channelCleared", (data) => {
      console.info(`[SocketIO] Channel cleared:`, data);
      this.emit("channelCleared", data);
    });

    this.socket.on("channelDeleted", (data) => {
      console.info(`[SocketIO] Channel deleted:`, data);
      this.emit("channelDeleted", data);
    });

    this.socket.on("log_stream", (data) => {
      this.emit("logStream", data);
    });

    this.socket.on("disconnect", (reason) => {
      console.info(`[SocketIO] Disconnected. Reason: ${reason}`);
      this.isConnected = false;

      // Reset connect promise for next connection
      this.connectPromise = new Promise<void>((resolve) => {
        this.resolveConnect = resolve;
      });

      if (reason === "io server disconnect") {
        this.socket?.connect();
      }
    });

    this.socket.on("connect_error", (error) => {
      console.error("[SocketIO] Connection error:", error);
      console.error("[SocketIO] Error details:", {
        message: error.message,
        description: (error as any).description,
        context: (error as any).context,
        type: (error as any).type,
      });
    });
  }

  /**
   * Join a channel to receive messages from it
   * @param channelId Channel ID to join
   * @param serverId Optional server ID for the channel
   */
  public async joinChannel(
    channelId: string,
    serverId?: string,
  ): Promise<void> {
    if (!this.socket) {
      console.error("[SocketIO] Cannot join channel: socket not initialized");
      return;
    }

    // Wait for connection if needed
    if (!this.isConnected) {
      await this.connectPromise;
    }

    this.activeChannels.add(channelId);
    this.socket.emit("message", {
      type: SOCKET_MESSAGE_TYPE.ROOM_JOINING,
      payload: {
        channelId,
        serverId: serverId || this.serverId,
        entityId: this.entityId,
        metadata: { isDm: false },
      },
    });

    console.info(`[SocketIO] Joined channel ${channelId}`);
  }

  /**
   * Join a room to receive messages from it (backward compatibility)
   * @param roomId Room/Agent ID to join
   */
  public async joinRoom(roomId: string): Promise<void> {
    if (!this.socket) {
      console.error("[SocketIO] Cannot join room: socket not initialized");
      return;
    }

    // Wait for connection if needed
    if (!this.isConnected) {
      await this.connectPromise;
    }

    this.activeRooms.add(roomId);
    this.socket.emit("message", {
      type: SOCKET_MESSAGE_TYPE.ROOM_JOINING,
      payload: {
        roomId,
        entityId: this.entityId,
      },
    });

    console.info(`[SocketIO] Joined room ${roomId}`);
  }

  /**
   * Leave a channel to stop receiving messages from it
   * @param channelId Channel ID to leave
   */
  public leaveChannel(channelId: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn(
        `[SocketIO] Cannot leave channel ${channelId}: not connected`,
      );
      return;
    }

    this.activeChannels.delete(channelId);
    console.info(`[SocketIO] Left channel ${channelId}`);
  }

  /**
   * Leave a room to stop receiving messages from it (backward compatibility)
   * @param roomId Room/Agent ID to leave
   */
  public leaveRoom(roomId: string): void {
    if (!this.socket || !this.isConnected) {
      console.warn(`[SocketIO] Cannot leave room ${roomId}: not connected`);
      return;
    }

    this.activeRooms.delete(roomId);
    console.info(`[SocketIO] Left room ${roomId}`);
  }

  /**
   * Send a message to a specific channel
   * @param message Message text to send
   * @param channelId Channel ID to send the message to (usually central bus)
   * @param source Source identifier (e.g., 'client_chat')
   * @param sessionChannelId Optional session channel ID for filtering (following official client pattern)
   * @param serverId Optional server ID
   */
  public async sendChannelMessage(
    message: string,
    channelId: string,
    source: string,
    sessionChannelId?: string,
    serverId?: string,
  ): Promise<void> {
    if (!this.socket) {
      console.error(
        "[SocketIO] Cannot send channel message: socket not initialized",
      );
      return;
    }

    // Wait for connection if needed
    if (!this.isConnected) {
      await this.connectPromise;
    }

    const messageId = v4();
    const finalChannelId = sessionChannelId || channelId; // Use session channel ID if provided

    console.info(
      `[SocketIO] Sending message to channel ${channelId} with session ID ${finalChannelId}`,
    );

    // Emit message to server - always send to central bus but tag with session channel ID
    this.socket.emit("message", {
      type: SOCKET_MESSAGE_TYPE.SEND_MESSAGE,
      payload: {
        senderId: this.entityId,
        senderName: USER_NAME,
        message,
        channelId: finalChannelId, // Use session channel ID for proper routing
        roomId: finalChannelId, // Keep for backward compatibility
        serverId: serverId || this.serverId,
        messageId,
        source,
        attachments: [],
        metadata: {},
      },
    });

    // Immediately broadcast message locally so UI updates instantly
    this.emit("messageBroadcast", {
      senderId: this.entityId || "",
      senderName: USER_NAME,
      text: message,
      channelId: finalChannelId, // Use session channel ID for filtering
      roomId: finalChannelId, // Keep for backward compatibility
      createdAt: Date.now(),
      source,
      name: USER_NAME, // Required for ContentWithUser compatibility
    });
  }

  /**
   * Send a message to a specific room (backward compatibility)
   * @param message Message text to send
   * @param roomId Room/Agent ID to send the message to
   * @param source Source identifier (e.g., 'client_chat')
   */
  public async sendMessage(
    message: string,
    roomId: string,
    source: string,
  ): Promise<void> {
    if (!this.socket) {
      console.error("[SocketIO] Cannot send message: socket not initialized");
      return;
    }

    // Wait for connection if needed
    if (!this.isConnected) {
      await this.connectPromise;
    }

    const messageId = v4();
    const worldId = "00000000-0000-0000-0000-000000000000";

    console.info(`[SocketIO] Sending message to room ${roomId}`);

    // Emit message to server
    this.socket.emit("message", {
      type: SOCKET_MESSAGE_TYPE.SEND_MESSAGE,
      payload: {
        senderId: this.entityId,
        senderName: USER_NAME,
        message,
        roomId,
        worldId,
        messageId,
        source,
      },
    });

    // Immediately broadcast message locally so UI updates instantly
    this.emit("messageBroadcast", {
      senderId: this.entityId || "",
      senderName: USER_NAME,
      text: message,
      roomId,
      createdAt: Date.now(),
      source,
      name: USER_NAME, // Required for ContentWithUser compatibility
    });
  }

  /**
   * Subscribe to log streaming
   */
  public subscribeToLogs(): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("subscribe_logs");
      console.info("[SocketIO] Subscribed to log streaming");
    }
  }

  /**
   * Unsubscribe from log streaming
   */
  public unsubscribeFromLogs(): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("unsubscribe_logs");
      console.info("[SocketIO] Unsubscribed from log streaming");
    }
  }

  /**
   * Update log filters
   */
  public updateLogFilters(filters: {
    agentName?: string;
    level?: string;
  }): void {
    if (this.socket && this.isConnected) {
      this.socket.emit("update_log_filters", filters);
      console.info("[SocketIO] Updated log filters:", filters);
    }
  }

  /**
   * Get active channels
   */
  public getActiveChannels(): Set<string> {
    return new Set(this.activeChannels);
  }

  /**
   * Get active rooms (backward compatibility)
   */
  public getActiveRooms(): Set<string> {
    return new Set(this.activeRooms);
  }

  /**
   * Check if connected
   */
  public isSocketConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Get entity ID
   */
  public getEntityId(): string | null {
    return this.entityId;
  }

  /**
   * Get server ID
   */
  public getServerId(): string | null {
    return this.serverId;
  }

  /**
   * Set the active session channel ID for message filtering (following official client pattern)
   * @param sessionChannelId The session channel ID to filter messages by
   */
  public setActiveSessionChannelId(sessionChannelId: string): void {
    this.activeSessionChannelId = sessionChannelId;
    console.info(
      `[SocketIO] Active session channel set to: ${sessionChannelId}`,
    );
  }

  /**
   * Get the current active session channel ID
   */
  public getActiveSessionChannelId(): string | null {
    return this.activeSessionChannelId;
  }

  /**
   * Clear the active session channel ID
   */
  public clearActiveSessionChannelId(): void {
    this.activeSessionChannelId = null;
    console.info(`[SocketIO] Active session channel cleared`);
  }

  /**
   * Disconnect from the server
   */
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.activeChannels.clear();
      this.activeRooms.clear();
      console.info("[SocketIO] Disconnected from server");
    }
  }
}

export default SocketIOManager;
