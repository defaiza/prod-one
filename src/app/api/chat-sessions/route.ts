import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
const AGENT_ID = process.env.NEXT_PUBLIC_AGENT_ID;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json(
        { error: "userId parameter is required" },
        { status: 400 },
      );
    }

    if (!AGENT_ID) {
      return NextResponse.json(
        { error: "Agent ID not configured" },
        { status: 500 },
      );
    }

    // Fetch DM channels from ElizaOS server using the correct endpoint
    const channelsUrl = `${API_BASE_URL}/api/messaging/central-servers/00000000-0000-0000-0000-000000000000/channels`;
    console.log(`[API] Fetching channels from: ${channelsUrl}`);

    const response = await fetch(channelsUrl, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[API] ElizaOS API error (${response.status}):`, errorText);
      throw new Error(
        `ElizaOS API responded with status: ${response.status} - ${errorText}`,
      );
    }

    const data = await response.json();
    console.log(`[API] Received channels response:`, Object.keys(data));

    const channels = data.data?.channels || data.channels || [];
    console.log(`[API] Found ${channels.length} total channels`);

    // Filter for DM channels involving the user and agent (following ElizaOS client pattern)
    // Only include channels that have sessionId (new UUID-based sessions)
    const dmChannels = channels.filter((channel: any) => {
      const metadata = channel.metadata || {};
      const isCorrectType = channel.type === "DM";
      const isMarkedAsDm = metadata.isDm === true;
      const isForThisAgent = metadata.forAgent === AGENT_ID;
      const hasSessionId = metadata.sessionId; // Only new UUID-based sessions
      const isParticipant =
        (metadata.user1 === userId && metadata.user2 === AGENT_ID) ||
        (metadata.user1 === AGENT_ID && metadata.user2 === userId);

      return (
        isCorrectType &&
        isMarkedAsDm &&
        isForThisAgent &&
        hasSessionId &&
        isParticipant
      );
    });

    console.log(
      `[API] Found ${dmChannels.length} DM channels for user ${userId} and agent ${AGENT_ID}`,
    );

    let chatSessions: any[] = [];

    if (dmChannels.length > 0) {
      // Use proper DM channels if they exist
      chatSessions = await Promise.all(
        dmChannels.map(async (channel: any) => {
          try {
            const messagesResponse = await fetch(
              `${API_BASE_URL}/api/messaging/central-channels/${channel.id}/messages?limit=50`,
              {
                method: "GET",
                headers: { "Content-Type": "application/json" },
              },
            );

            let messages: any[] = [];
            let messageCount = 0;

            if (messagesResponse.ok) {
              const messagesData = await messagesResponse.json();
              messages =
                messagesData.data?.messages || messagesData.messages || [];
              messageCount = messages.length;
            }

            console.log(messagesResponse)

            // Find the first user message as the query
            const firstUserMessage = messages
              .sort(
                (a, b) =>
                  new Date(a.createdAt).getTime() -
                  new Date(b.createdAt).getTime(),
              )
              .find(
                (msg: any) =>
                  msg.authorId === userId ||
                  msg.rawMessage?.senderId === userId,
              );

            const lastMessage = messages[messages.length - 1];

            return {
              id: channel.metadata?.sessionId || channel.id, // Use sessionId as primary ID
              channelId: channel.id, // Keep channel ID for internal use
              title:
                firstUserMessage?.content ||
                channel.metadata?.initialMessage ||
                channel.name ||
                "New Chat",
              messageCount,
              lastActivity:
                lastMessage?.createdAt ||
                channel.updatedAt ||
                channel.createdAt,
              preview: lastMessage?.content?.substring(0, 100) || "",
              isFromAgent: lastMessage?.authorId === AGENT_ID,
              createdAt: channel.createdAt,
              // Remove query field - sessions are no longer query-based
            };
          } catch (error) {
            console.error(
              `[API] Error fetching messages for channel ${channel.id}:`,
              error,
            );
            return {
              id: channel.metadata?.sessionId || channel.id, // Use sessionId as primary ID
              channelId: channel.id, // Keep channel ID for internal use
              title:
                channel.metadata?.initialMessage || channel.name || "New Chat",
              messageCount: 0,
              lastActivity: channel.updatedAt || channel.createdAt,
              preview: "",
              isFromAgent: false,
              createdAt: channel.createdAt,
            };
          }
        }),
      );
    } else {
      // No UUID-based sessions found
      console.log(`[API] No UUID-based DM channels found for user ${userId}`);
      chatSessions = [];
    }

    // Sort by last activity (most recent first)
    chatSessions.sort(
      (a, b) =>
        new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime(),
    );

    return NextResponse.json({
      success: true,
      data: {
        userId,
        sessions: chatSessions,
        totalSessions: chatSessions.length,
      },
    });
  } catch (error) {
    console.error("[API] Error fetching chat sessions:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch chat sessions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
