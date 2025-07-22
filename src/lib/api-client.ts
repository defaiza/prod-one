import type { ChatMessage } from "@/types/chat-message";
import { assert } from "@/utils/assert";

// Use Next.js API proxy to avoid CORS issues
const API_PREFIX = "/api/eliza";

// Optional API key for authentication
const API_KEY = process.env.NEXT_PUBLIC_API_KEY;

console.log("API_PREFIX", API_PREFIX);

// ElizaOS API Response Types
interface ElizaAPIResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// Backend Memory type from ElizaOS
interface BackendMemory {
  id: string;
  entityId: string; // UUID of sender (user or agent)
  agentId: string; // UUID of the agent this memory belongs to
  roomId: string; // UUID of the room
  content: {
    text?: string;
    source?: string;
    thought?: string;
    actions?: string[];
    attachments?: any[];
    [key: string]: any;
  };
  metadata?: {
    entityName?: string;
    [key: string]: any;
  };
  createdAt: number;
  worldId?: string;
  importance?: number;
  [key: string]: any;
}

// Agent information
interface Agent {
  id: string;
  name: string;
  bio?: string;
  settings?: Record<string, any>;
  status?: "active" | "inactive";
  [key: string]: any;
}

// Room information
interface Room {
  id: string;
  name: string;
  type: "dm" | "group" | "channel";
  agentId: string;
  worldId?: string;
  serverId?: string;
  metadata?: Record<string, any>;
  [key: string]: any;
}

// Channel information
interface Channel {
  id: string;
  name: string;
  serverId: string;
  description?: string;
  participants?: string[];
  agents?: string[];
  [key: string]: any;
}

// Message submission payload
interface MessageSubmission {
  message: string;
  agentId: string;
  roomId?: string;
  channelId?: string;
  serverId?: string;
  senderId?: string;
  senderName?: string;
  source?: string;
  attachments?: any[];
  metadata?: Record<string, any>;
}

/**
 * Enhanced fetch wrapper with API key authentication
 */
const fetcher = async (
  url: string,
  options: RequestInit = {},
): Promise<any> => {
  const fullUrl = API_PREFIX + (url.startsWith("/") ? url : `/${url}`);

  // Prepare headers with optional API key
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (API_KEY) {
    headers["X-API-KEY"] = API_KEY;
  }

  const requestOptions: RequestInit = {
    ...options,
    headers,
    mode: "cors", // Explicitly set CORS mode
    credentials: "omit", // Don't send credentials for CORS
  };

  console.log(`[API Client] Fetching: ${options.method || "GET"} ${fullUrl}`);

  try {
    const response = await fetch(fullUrl, requestOptions);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = await response.text();
      }
      console.error("[API Client] Fetch error:", {
        status: response.status,
        statusText: response.statusText,
        data: errorData,
      });
      throw new Error(
        `API request failed: ${response.status} ${response.statusText}`,
      );
    }

    // Check content type before parsing
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      return await response.json();
    }
    return await response.text();
  } catch (error) {
    console.error("[API Client] Network or parsing error:", error);
    throw error;
  }
};

// ====== AGENT MANAGEMENT ======

/**
 * Get all available agents
 */
export const getAgents = async (): Promise<Agent[]> => {
  try {
    const response: ElizaAPIResponse<Agent[]> = await fetcher("/agents");
    return response.data || [];
  } catch (error) {
    console.error("[API Client] Error fetching agents:", error);
    return [];
  }
};

/**
 * Get specific agent details
 */
export const getAgent = async (agentId: string): Promise<Agent | null> => {
  try {
    const response: ElizaAPIResponse<Agent> = await fetcher(
      `/agents/${agentId}`,
    );
    return response.data || null;
  } catch (error) {
    console.error("[API Client] Error fetching agent:", error);
    return null;
  }
};

// ====== MEMORY MANAGEMENT ======

/**
 * Fetches memories for a given agent (latest API)
 */
export const getAgentMemories = async (
  agentId: string,
  limit: number = 50,
): Promise<ChatMessage[]> => {
  assert(
    agentId && typeof agentId === "string",
    "[getAgentMemories] Invalid agentId",
  );

  try {
    const url = `/memory/${agentId}/memories?limit=${limit}`;
    const response: ElizaAPIResponse<{ memories: BackendMemory[] }> =
      await fetcher(url);

    if (!response.success || !Array.isArray(response.data?.memories)) {
      console.error(
        "[getAgentMemories] Failed to get valid memories from API.",
        response,
      );
      return [];
    }

    const memories: BackendMemory[] = response.data.memories;
    console.log(
      `[getAgentMemories] Received ${memories.length} memories from API.`,
    );

    return transformMemoriesToChatMessages(memories);
  } catch (error) {
    console.error(
      "[getAgentMemories] Error fetching or processing memories:",
      error,
    );
    return [];
  }
};

/**
 * Fetches memories for a specific room (latest API)
 */
export const getRoomMemories = async (
  agentId: string,
  roomId: string,
  limit: number = 50,
): Promise<ChatMessage[]> => {
  assert(
    agentId && typeof agentId === "string",
    "[getRoomMemories] Invalid agentId",
  );
  assert(
    roomId && typeof roomId === "string",
    "[getRoomMemories] Invalid roomId",
  );

  try {
    const url = `/memory/${agentId}/rooms/${roomId}/memories?limit=${limit}`;
    const response: ElizaAPIResponse<{ memories: BackendMemory[] }> =
      await fetcher(url);

    if (!response.success || !Array.isArray(response.data?.memories)) {
      console.error(
        "[getRoomMemories] Failed to get valid memories from API.",
        response,
      );
      return [];
    }

    const memories: BackendMemory[] = response.data.memories;
    console.log(
      `[getRoomMemories] Received ${memories.length} memories for room ${roomId}.`,
    );

    return transformMemoriesToChatMessages(memories);
  } catch (error) {
    console.error(
      "[getRoomMemories] Error fetching or processing memories:",
      error,
    );
    return [];
  }
};

/**
 * Transform backend memories to frontend chat messages
 */
function transformMemoriesToChatMessages(
  memories: BackendMemory[],
): ChatMessage[] {
  return memories
    .map((mem) => {
      const isUser = mem.entityId !== mem.agentId;
      const message: ChatMessage = {
        id: mem.id,
        name: isUser
          ? mem.metadata?.entityName || "User"
          : mem.metadata?.entityName || "Agent",
        text:
          mem.content?.text ||
          (mem.content?.thought ? `*${mem.content.thought}*` : ""),
        senderId: mem.entityId,
        roomId: mem.roomId,
        createdAt: mem.createdAt || Date.now(),
        isLoading: false,
        source: mem.content?.source || "API",
        thought: mem.content?.thought,
        actions: Array.isArray(mem.content?.actions)
          ? mem.content.actions
          : undefined,
      };

      assert(
        typeof message.name === "string" && message.text !== undefined,
        `[transformMemoriesToChatMessages] Invalid transformed message: ${JSON.stringify(message)}`,
      );

      return message;
    })
    .sort((a, b) => a.createdAt - b.createdAt);
}

// ====== MESSAGING SYSTEM ======

/**
 * Submit a message via the messaging system
 */
export const submitMessage = async (
  payload: MessageSubmission,
): Promise<boolean> => {
  try {
    const response: ElizaAPIResponse = await fetcher("/messaging/submit", {
      method: "POST",
      body: JSON.stringify(payload),
    });

    return response.success || false;
  } catch (error) {
    console.error("[API Client] Error submitting message:", error);
    return false;
  }
};

/**
 * Get channel messages
 */
export const getChannelMessages = async (
  channelId: string,
  limit: number = 50,
): Promise<ChatMessage[]> => {
  try {
    const response: ElizaAPIResponse<{ messages: any[] }> = await fetcher(
      `/messaging/central-channels/${channelId}/messages?limit=${limit}`,
    );

    if (!response.success || !Array.isArray(response.data?.messages)) {
      return [];
    }

    // Get agent ID from environment for proper agent detection
    const AGENT_ID = process.env.NEXT_PUBLIC_AGENT_ID;

    // Transform channel messages to match the UI format exactly
    return response.data.messages.map((msg) => {
      // More accurate agent detection using agent ID
      const isAgentMessage = msg.senderId === AGENT_ID || msg.authorId === AGENT_ID;
      
      return {
        id: msg.id,
        name: isAgentMessage ? "Agent" : "User",
        text: msg.content || msg.text || "",
        senderId: msg.senderId || msg.authorId || "",
        roomId: channelId,
        createdAt: new Date(msg.createdAt).getTime(),
        source: msg.source || "API",
        thought: msg.metadata?.thought,
        actions: msg.metadata?.actions,
        isLoading: false,
      };
    }).sort((a, b) => a.createdAt - b.createdAt); // Ensure chronological order
  } catch (error) {
    console.error("[API Client] Error fetching channel messages:", error);
    return [];
  }
};

/**
 * Send message to channel
 */
export const sendChannelMessage = async (
  channelId: string,
  content: string,
  userId: string,
  agentId?: string,
): Promise<boolean> => {
  try {
    const response: ElizaAPIResponse = await fetcher(
      `/messaging/central-channels/${channelId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({
          content,
          userId,
          agentId,
        }),
      },
    );

    return response.success || false;
  } catch (error) {
    console.error("[API Client] Error sending channel message:", error);
    return false;
  }
};

// ====== ROOM MANAGEMENT ======

/**
 * Get agent rooms
 */
export const getAgentRooms = async (agentId: string): Promise<Room[]> => {
  try {
    const response: ElizaAPIResponse<Room[]> = await fetcher(
      `/memory/${agentId}/rooms`,
    );
    return response.data || [];
  } catch (error) {
    console.error("[API Client] Error fetching agent rooms:", error);
    return [];
  }
};

/**
 * Create a new room
 */
export const createRoom = async (
  agentId: string,
  roomData: Partial<Room>,
): Promise<Room | null> => {
  try {
    const response: ElizaAPIResponse<Room> = await fetcher(
      `/memory/${agentId}/rooms`,
      {
        method: "POST",
        body: JSON.stringify(roomData),
      },
    );

    return response.data || null;
  } catch (error) {
    console.error("[API Client] Error creating room:", error);
    return null;
  }
};

// ====== SERVER HEALTH ======

/**
 * Ping server for health check
 */
export const pingServer = async (): Promise<boolean> => {
  try {
    const response = await fetcher("/server/ping");
    console.log("[API Client] Ping response:", response);
    // ElizaOS returns {pong: true, timestamp: number} for successful ping
    return response.pong === true || response.success === true;
  } catch (error) {
    console.error("[API Client] Server ping failed:", error);
    return false;
  }
};

/**
 * Get server status
 */
export const getServerStatus = async (): Promise<any> => {
  try {
    const response: ElizaAPIResponse = await fetcher("/server/status");
    return response.data || null;
  } catch (error) {
    console.error("[API Client] Error fetching server status:", error);
    return null;
  }
};

// ====== DM CHANNEL MANAGEMENT ======

interface DMChannel {
  id: string;
  name: string;
  type: "DM";
  metadata: {
    isDm: true;
    user1: string;
    user2: string;
    forAgent: string;
    createdAt: string;
    sessionId?: string;
    title?: string;
  };
  participants: string[];
}

/**
 * Create a new DM channel
 */
export const createDMChannel = async (
  userId: string,
  agentId: string,
  channelId?: string,
  title?: string,
): Promise<DMChannel | null> => {
  try {
    const response = await fetch("/api/dm-channel/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        agentId,
        channelId,
        title,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[API Client] Failed to create DM channel:", errorData);
      return null;
    }

    const data = await response.json();
    return data.success ? data.channel : null;
  } catch (error) {
    console.error("[API Client] Error creating DM channel:", error);
    return null;
  }
};

/**
 * Get or create a DM channel for a session
 */
export const getOrCreateDMChannel = async (
  userId: string,
  agentId: string,
  sessionId?: string,
): Promise<{ channel: DMChannel; isNew: boolean } | null> => {
  try {
    const response = await fetch("/api/dm-channel/get-or-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        agentId,
        sessionId,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error(
        "[API Client] Failed to get or create DM channel:",
        errorData,
      );
      return null;
    }

    const data = await response.json();
    return data.success ? { channel: data.channel, isNew: data.isNew } : null;
  } catch (error) {
    console.error("[API Client] Error getting or creating DM channel:", error);
    return null;
  }
};

/**
 * List DM channels for a user and agent
 */
export const listDMChannels = async (
  userId: string,
  agentId: string,
): Promise<DMChannel[]> => {
  try {
    const response = await fetch(
      `/api/dm-channel/list?userId=${encodeURIComponent(userId)}&agentId=${encodeURIComponent(agentId)}`,
      {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      },
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error("[API Client] Failed to list DM channels:", errorData);
      return [];
    }

    const data = await response.json();
    return data.success ? data.channels : [];
  } catch (error) {
    console.error("[API Client] Error listing DM channels:", error);
    return [];
  }
};
