import { NextRequest, NextResponse } from "next/server";

const ELIZA_SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

interface CreateDMChannelRequest {
  userId: string;
  agentId: string;
  channelId?: string; // Optional - will be generated if not provided
  title?: string; // Optional title for the channel
}

interface DMChannelMetadata {
  isDm: true;
  user1: string;
  user2: string;
  forAgent: string;
  createdAt: string;
  title?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateDMChannelRequest = await request.json();
    const { userId, agentId, channelId, title } = body;

    if (!userId || !agentId) {
      return NextResponse.json(
        { error: "userId and agentId are required" },
        { status: 400 },
      );
    }

    console.log("entered into the dm channel create file....")

    // Generate channel ID if not provided
    const finalChannelId = channelId || `dm-${userId}-${agentId}-${Date.now()}`;
    const channelName = title || `Chat - ${new Date().toLocaleString()}`;

    // Create DM channel metadata following official client pattern
    const metadata: DMChannelMetadata = {
      isDm: true,
      user1: userId,
      user2: agentId,
      forAgent: agentId,
      createdAt: new Date().toISOString(),
    };

    if (title) {
      metadata.title = title;
    }

    // Create the DM channel via ElizaOS API
    const createChannelResponse = await fetch(
      `${ELIZA_SERVER_URL}/api/messaging/central-channels`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: finalChannelId,
          name: channelName,
          server_id: "00000000-0000-0000-0000-000000000000", // Required server ID
          participantCentralUserIds: [userId, agentId],
          type: "DM", // Channel type
          metadata: metadata,
        }),
      },
    );

    if (!createChannelResponse.ok) {
      const errorText = await createChannelResponse.text();
      console.error("[DM Channel API] Failed to create channel:", errorText);
      return NextResponse.json(
        { error: "Failed to create DM channel", details: errorText },
        { status: 500 },
      );
    }

    const channelData = await createChannelResponse.json();

    // Add agent to the channel as a participant
    const addAgentResponse = await fetch(
      `${ELIZA_SERVER_URL}/api/messaging/central-channels/${finalChannelId}/agents`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          agentId: agentId,
        }),
      },
    );

    if (!addAgentResponse.ok) {
      const errorText = await addAgentResponse.text();
      console.warn(
        "[DM Channel API] Failed to add agent to channel:",
        errorText,
      );
      // Continue anyway - agent might already be a participant
    }

    return NextResponse.json({
      success: true,
      channel: {
        id: finalChannelId,
        name: channelName,
        type: "DM",
        metadata: metadata,
        participants: [userId, agentId],
        ...channelData,
      },
    });
  } catch (error) {
    console.error("[DM Channel API] Error creating DM channel:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
