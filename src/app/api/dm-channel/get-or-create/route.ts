import { NextRequest, NextResponse } from "next/server";

const ELIZA_SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

interface GetOrCreateDMChannelRequest {
  userId: string;
  agentId: string;
  sessionId?: string; // Optional session ID for deterministic channel creation
  initialMessage?: string; // Optional initial message for new sessions
}

interface DMChannelMetadata {
  isDm: true;
  user1: string;
  user2: string;
  forAgent: string;
  createdAt: string;
  sessionId?: string;
  initialMessage?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: GetOrCreateDMChannelRequest = await request.json();
    const { userId, agentId, sessionId, initialMessage } = body;

    if (!userId || !agentId) {
      return NextResponse.json(
        { error: "userId and agentId are required" },
        { status: 400 },
      );
    }

    console.log("got into the ger or create dm channel file......")

    // First, try to find an existing DM channel for this session if sessionId is provided
    if (sessionId) {
      try {
        console.log("[DM Channel API] Checking for existing channels with sessionId");
        const channelsResponse = await fetch(
          `${ELIZA_SERVER_URL}/api/messaging/central-channels`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        console.log("fetched channels response", channelsResponse.status)

        if (channelsResponse.ok) {
          const allChannels = await channelsResponse.json();

          // Look for existing channel with this EXACT session ID only
          const existingChannel = allChannels.find((channel: any) => {
            const metadata = channel.metadata || {};
            return (
              channel.id === sessionId ||
              metadata.sessionId === sessionId
            );
          });

          if (existingChannel) {
            console.log(
              "[DM Channel API] Found existing channel for session:",
              sessionId,
            );
            return NextResponse.json({
              success: true,
              channel: existingChannel,
              isNew: false,
            });
          }
        }
      } catch (error) {
        console.warn(
          "[DM Channel API] Error checking for existing channels:",
          error,
        );
        // Continue to create new channel
      }
    }

    // Create new DM channel
    const finalChannelId = sessionId || `dm-${userId}-${agentId}-${Date.now()}`;
    const channelName = `Chat - ${new Date().toLocaleString()}`;

    console.log("final chanelId............................", finalChannelId)
    console.log("channelName...............................", channelName)

    // Create DM channel metadata following official client pattern
    const metadata: DMChannelMetadata = {
      isDm: true,
      user1: userId,
      user2: agentId,
      forAgent: agentId,
      createdAt: new Date().toISOString(),
    };

    if (sessionId) {
      metadata.sessionId = sessionId;
    }

    if (initialMessage) {
      metadata.initialMessage = initialMessage;
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

    console.log(createChannelResponse.status, "create channel response status")
    console.log(createChannelResponse.statusText, "create channel response status text")

    const channelData = await createChannelResponse.json();

    // Add agent to the channel as a participant
    try {
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
    } catch (error) {
      console.warn("[DM Channel API] Error adding agent to channel:", error);
      // Continue anyway
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
      isNew: true,
    });
  } catch (error) {
    console.error("[DM Channel API] Error in get-or-create DM channel:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
