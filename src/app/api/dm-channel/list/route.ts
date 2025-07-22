import { NextRequest, NextResponse } from "next/server";

const ELIZA_SERVER_URL =
  process.env.NEXT_PUBLIC_SERVER_URL || "http://localhost:3000";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    const agentId = searchParams.get("agentId");

    if (!userId || !agentId) {
      return NextResponse.json(
        { error: "userId and agentId are required" },
        { status: 400 },
      );
    }

    // Get all channels from the server
    const channelsResponse = await fetch(
      `${ELIZA_SERVER_URL}/api/messaging/central-channels`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      },
    );

    if (!channelsResponse.ok) {
      const errorText = await channelsResponse.text();
      console.error("[DM Channel List API] Failed to get channels:", errorText);
      return NextResponse.json(
        { error: "Failed to get channels", details: errorText },
        { status: 500 },
      );
    }

    const allChannels = await channelsResponse.json();

    // Filter for DM channels between this user and agent
    const dmChannels = allChannels.filter((channel: any) => {
      const metadata = channel.metadata || {};

      // Check if it's a DM channel
      const isDmChannel = channel.type === "DM" || metadata.isDm === true;
      if (!isDmChannel) return false;

      // Check if it's for this specific agent
      const isForThisAgent = metadata.forAgent === agentId;
      if (!isForThisAgent) return false;

      // Check if this user is a participant
      const isParticipant =
        (metadata.user1 === userId && metadata.user2 === agentId) ||
        (metadata.user1 === agentId && metadata.user2 === userId);

      return isParticipant;
    });

    // Sort by creation date (newest first)
    dmChannels.sort((a: any, b: any) => {
      const aDate = a.metadata?.createdAt
        ? new Date(a.metadata.createdAt).getTime()
        : 0;
      const bDate = b.metadata?.createdAt
        ? new Date(b.metadata.createdAt).getTime()
        : 0;
      return bDate - aDate;
    });

    return NextResponse.json({
      success: true,
      channels: dmChannels,
      count: dmChannels.length,
    });
  } catch (error) {
    console.error("[DM Channel List API] Error listing DM channels:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
