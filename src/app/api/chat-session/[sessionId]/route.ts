import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";
const AGENT_ID = process.env.NEXT_PUBLIC_AGENT_ID;

interface RouteParams {
  params: Promise<{
    sessionId: string;
  }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { sessionId } = await params;
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

    console.log(`[API] Fetching session: ${sessionId} for user: ${userId}`);

    // Get all channels from the correct ElizaOS API endpoint
    const channelsResponse = await fetch(
      `${API_BASE_URL}/api/messaging/central-servers/00000000-0000-0000-0000-000000000000/channels`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!channelsResponse.ok) {
      const errorText = await channelsResponse.text();
      console.error(`[API] Failed to fetch channels:`, errorText);
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const channelsData = await channelsResponse.json();
    const channels = channelsData.data?.channels || channelsData.channels || [];

    // Find the channel with matching sessionId ONLY
    const sessionChannel = channels.find((channel: any) => {
      const metadata = channel.metadata || {};
      return (
        channel.id === sessionId ||
        metadata.sessionId === sessionId
      );
    });

    if (!sessionChannel) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Fetch messages for this session using the correct API endpoint
    let messages: any[] = [];
    let messageCount = 0;

    try {
      const messagesResponse = await fetch(
        `${API_BASE_URL}/api/messaging/central-channels/${sessionChannel.id}/messages?limit=100`,
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        },
      );

      if (messagesResponse.ok) {
        const messagesData = await messagesResponse.json();
        messages = messagesData.data?.messages || messagesData.messages || [];
        messageCount = messages.length;
      }
    } catch (error) {
      console.error(
        `[API] Error fetching messages for session ${sessionId}:`,
        error,
      );
    }

    // Find the first user message to use as session title
    const firstUserMessage = messages
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      )
      .find(
        (msg: any) =>
          msg.authorId === userId || msg.rawMessage?.senderId === userId,
      );

    const lastMessage = messages[messages.length - 1];

    const sessionData = {
      id: sessionId,
      channelId: sessionChannel.id,
      title: sessionChannel.name || "New Chat", // Use the channel name (timestamp-based)
      messageCount,
      lastActivity:
        lastMessage?.createdAt ||
        sessionChannel.updatedAt ||
        sessionChannel.createdAt,
      preview: lastMessage?.content?.substring(0, 100) || "",
      isFromAgent: lastMessage?.authorId === AGENT_ID,
      createdAt: sessionChannel.createdAt,
      userId,
      agentId: AGENT_ID,
      metadata: sessionChannel.metadata,
    };

    return NextResponse.json({
      success: true,
      data: sessionData,
    });
  } catch (error) {
    console.error(`[API] Error fetching session:`, error);
    return NextResponse.json(
      {
        error: "Failed to fetch session",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
