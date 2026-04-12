import { Hono } from "hono";
import {
  successResponse,
  errorResponse,
  type EntityInvitation,
} from "@sudobility/entitystarter_types";
import { entityHelpers as helpers } from "../lib/entity-helpers";

type Variables = {
  userId: string;
  userEmail: string | null;
};

const invitationsRouter = new Hono<{ Variables: Variables }>();

invitationsRouter.get("/", async c => {
  const userEmail = c.get("userEmail");

  if (!userEmail) {
    return c.json(successResponse<EntityInvitation[]>([]));
  }

  try {
    const invitations: EntityInvitation[] =
      await helpers.invitations.getUserPendingInvitations(userEmail);
    return c.json(successResponse(invitations));
  } catch (error: any) {
    console.error("Error listing user invitations:", error);
    return c.json(errorResponse(error.message || "Internal server error"), 500);
  }
});

invitationsRouter.post("/:token/accept", async c => {
  const userId = c.get("userId");
  const token = c.req.param("token");

  try {
    await helpers.invitations.acceptInvitation(token, userId);
    return c.json(successResponse<null>(null));
  } catch (error: any) {
    console.error("Error accepting invitation:", error);
    return c.json(errorResponse(error.message || "Bad request"), 400);
  }
});

invitationsRouter.post("/:token/decline", async c => {
  const token = c.req.param("token");

  try {
    await helpers.invitations.declineInvitation(token);
    return c.json(successResponse<null>(null));
  } catch (error: any) {
    console.error("Error declining invitation:", error);
    return c.json(errorResponse(error.message || "Bad request"), 400);
  }
});

export default invitationsRouter;
