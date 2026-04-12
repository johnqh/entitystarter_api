import { Hono } from "hono";
import {
  successResponse,
  errorResponse,
  type Entity,
  type EntityWithRole,
  type EntityMember,
  type EntityInvitation,
  type CreateEntityRequest,
  type UpdateEntityRequest,
  type InviteMemberRequest,
  type UpdateMemberRoleRequest,
} from "@sudobility/entitystarter_types";
import { entityHelpers as helpers } from "../lib/entity-helpers";

type Variables = {
  userId: string;
  userEmail: string | null;
};

const entitiesRouter = new Hono<{ Variables: Variables }>();

// =============================================================================
// Entity CRUD Routes
// =============================================================================

entitiesRouter.get("/", async c => {
  const userId = c.get("userId");
  const userEmail = c.get("userEmail");

  try {
    const userEntities: EntityWithRole[] = await helpers.entity.getUserEntities(
      userId,
      userEmail ?? undefined
    );
    return c.json(successResponse(userEntities));
  } catch (error: any) {
    console.error("Error listing entities:", error);
    return c.json(errorResponse(error.message || "Internal server error"), 500);
  }
});

entitiesRouter.post("/", async c => {
  const userId = c.get("userId");
  const body: CreateEntityRequest = await c.req.json();

  const { displayName, entitySlug, description } = body;

  if (!displayName) {
    return c.json(errorResponse("displayName is required"), 400);
  }

  try {
    const entity: Entity = await helpers.entity.createOrganizationEntity(
      userId,
      {
        displayName,
        entitySlug,
        description,
      }
    );
    return c.json(successResponse(entity), 201);
  } catch (error: any) {
    console.error("Error creating entity:", error);
    return c.json(errorResponse(error.message || "Bad request"), 400);
  }
});

entitiesRouter.get("/:entitySlug", async c => {
  const userId = c.get("userId");
  const entitySlug = c.req.param("entitySlug");

  try {
    const entity = await helpers.entity.getEntityBySlug(entitySlug);
    if (!entity) {
      return c.json(errorResponse("Entity not found"), 404);
    }

    const isMember = await helpers.members.isMember(entity.id, userId);
    if (!isMember) {
      return c.json(errorResponse("Access denied"), 403);
    }

    const role = await helpers.members.getUserRole(entity.id, userId);
    const entityWithRole: EntityWithRole = { ...entity, userRole: role! };
    return c.json(successResponse(entityWithRole));
  } catch (error: any) {
    console.error("Error getting entity:", error);
    return c.json(errorResponse(error.message || "Internal server error"), 500);
  }
});

entitiesRouter.put("/:entitySlug", async c => {
  const userId = c.get("userId");
  const entitySlug = c.req.param("entitySlug");
  const body: UpdateEntityRequest = await c.req.json();

  try {
    const entity = await helpers.entity.getEntityBySlug(entitySlug);
    if (!entity) {
      return c.json(errorResponse("Entity not found"), 404);
    }

    const canEdit = await helpers.permissions.canEditEntity(entity.id, userId);
    if (!canEdit) {
      return c.json(errorResponse("Insufficient permissions"), 403);
    }

    const updated: Entity = await helpers.entity.updateEntity(entity.id, body);
    return c.json(successResponse(updated));
  } catch (error: any) {
    console.error("Error updating entity:", error);
    return c.json(errorResponse(error.message || "Bad request"), 400);
  }
});

entitiesRouter.delete("/:entitySlug", async c => {
  const userId = c.get("userId");
  const entitySlug = c.req.param("entitySlug");

  try {
    const entity = await helpers.entity.getEntityBySlug(entitySlug);
    if (!entity) {
      return c.json(errorResponse("Entity not found"), 404);
    }

    const canDelete = await helpers.permissions.canDeleteEntity(
      entity.id,
      userId
    );
    if (!canDelete) {
      return c.json(errorResponse("Insufficient permissions"), 403);
    }

    await helpers.entity.deleteEntity(entity.id);
    return c.json(successResponse<null>(null));
  } catch (error: any) {
    console.error("Error deleting entity:", error);
    return c.json(errorResponse(error.message || "Bad request"), 400);
  }
});

// =============================================================================
// Member Routes
// =============================================================================

entitiesRouter.get("/:entitySlug/members", async c => {
  const userId = c.get("userId");
  const entitySlug = c.req.param("entitySlug");

  try {
    const entity = await helpers.entity.getEntityBySlug(entitySlug);
    if (!entity) {
      return c.json(errorResponse("Entity not found"), 404);
    }

    const canView = await helpers.permissions.canViewEntity(entity.id, userId);
    if (!canView) {
      return c.json(errorResponse("Access denied"), 403);
    }

    const members: EntityMember[] = await helpers.members.getMembers(entity.id);
    return c.json(successResponse(members));
  } catch (error: any) {
    console.error("Error listing members:", error);
    return c.json(errorResponse(error.message || "Internal server error"), 500);
  }
});

entitiesRouter.put("/:entitySlug/members/:memberId", async c => {
  const userId = c.get("userId");
  const entitySlug = c.req.param("entitySlug");
  const memberId = c.req.param("memberId");
  const body: UpdateMemberRoleRequest = await c.req.json();

  const { role } = body;
  if (!role) {
    return c.json(errorResponse("role is required"), 400);
  }

  try {
    const entity = await helpers.entity.getEntityBySlug(entitySlug);
    if (!entity) {
      return c.json(errorResponse("Entity not found"), 404);
    }

    const canManage = await helpers.permissions.canManageMembers(
      entity.id,
      userId
    );
    if (!canManage) {
      return c.json(errorResponse("Insufficient permissions"), 403);
    }

    const updated: EntityMember = await helpers.members.updateMemberRole(
      entity.id,
      memberId,
      role
    );
    return c.json(successResponse(updated));
  } catch (error: any) {
    console.error("Error updating member role:", error);
    return c.json(errorResponse(error.message || "Bad request"), 400);
  }
});

entitiesRouter.delete("/:entitySlug/members/:memberId", async c => {
  const userId = c.get("userId");
  const entitySlug = c.req.param("entitySlug");
  const memberId = c.req.param("memberId");

  try {
    const entity = await helpers.entity.getEntityBySlug(entitySlug);
    if (!entity) {
      return c.json(errorResponse("Entity not found"), 404);
    }

    const canManage = await helpers.permissions.canManageMembers(
      entity.id,
      userId
    );
    if (!canManage) {
      return c.json(errorResponse("Insufficient permissions"), 403);
    }

    await helpers.members.removeMember(entity.id, memberId);
    return c.json(successResponse<null>(null));
  } catch (error: any) {
    console.error("Error removing member:", error);
    return c.json(errorResponse(error.message || "Bad request"), 400);
  }
});

// =============================================================================
// Invitation Routes
// =============================================================================

entitiesRouter.get("/:entitySlug/invitations", async c => {
  const userId = c.get("userId");
  const entitySlug = c.req.param("entitySlug");

  try {
    const entity = await helpers.entity.getEntityBySlug(entitySlug);
    if (!entity) {
      return c.json(errorResponse("Entity not found"), 404);
    }

    const canManage = await helpers.permissions.canManageMembers(
      entity.id,
      userId
    );
    if (!canManage) {
      return c.json(errorResponse("Insufficient permissions"), 403);
    }

    const invitations: EntityInvitation[] =
      await helpers.invitations.getEntityInvitations(entity.id);
    return c.json(successResponse(invitations));
  } catch (error: any) {
    console.error("Error listing invitations:", error);
    return c.json(errorResponse(error.message || "Internal server error"), 500);
  }
});

entitiesRouter.post("/:entitySlug/invitations", async c => {
  const userId = c.get("userId");
  const entitySlug = c.req.param("entitySlug");
  const body: InviteMemberRequest = await c.req.json();

  const { email, role } = body;
  if (!email || !role) {
    return c.json(errorResponse("email and role are required"), 400);
  }

  try {
    const entity = await helpers.entity.getEntityBySlug(entitySlug);
    if (!entity) {
      return c.json(errorResponse("Entity not found"), 404);
    }

    const canInvite = await helpers.permissions.canInviteMembers(
      entity.id,
      userId
    );
    if (!canInvite) {
      return c.json(errorResponse("Insufficient permissions"), 403);
    }

    const invitation: EntityInvitation =
      await helpers.invitations.createInvitation(entity.id, userId, {
        email,
        role,
      });

    return c.json(successResponse(invitation), 201);
  } catch (error: any) {
    console.error("Error creating invitation:", error);
    return c.json(errorResponse(error.message || "Bad request"), 400);
  }
});

entitiesRouter.put("/:entitySlug/invitations/:invitationId", async c => {
  const userId = c.get("userId");
  const entitySlug = c.req.param("entitySlug");
  const invitationId = c.req.param("invitationId");

  try {
    const entity = await helpers.entity.getEntityBySlug(entitySlug);
    if (!entity) {
      return c.json(errorResponse("Entity not found"), 404);
    }

    const canManage = await helpers.permissions.canManageMembers(
      entity.id,
      userId
    );
    if (!canManage) {
      return c.json(errorResponse("Insufficient permissions"), 403);
    }

    const renewed: EntityInvitation =
      await helpers.invitations.renewInvitation(invitationId);
    return c.json(successResponse(renewed));
  } catch (error: any) {
    console.error("Error renewing invitation:", error);
    return c.json(errorResponse(error.message || "Bad request"), 400);
  }
});

entitiesRouter.delete("/:entitySlug/invitations/:invitationId", async c => {
  const userId = c.get("userId");
  const entitySlug = c.req.param("entitySlug");
  const invitationId = c.req.param("invitationId");

  try {
    const entity = await helpers.entity.getEntityBySlug(entitySlug);
    if (!entity) {
      return c.json(errorResponse("Entity not found"), 404);
    }

    const canManage = await helpers.permissions.canManageMembers(
      entity.id,
      userId
    );
    if (!canManage) {
      return c.json(errorResponse("Insufficient permissions"), 403);
    }

    await helpers.invitations.cancelInvitation(invitationId);
    return c.json(successResponse<null>(null));
  } catch (error: any) {
    console.error("Error canceling invitation:", error);
    return c.json(errorResponse(error.message || "Bad request"), 400);
  }
});

export default entitiesRouter;
