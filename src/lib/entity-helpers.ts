import { db, entities, entityMembers, entityInvitations, users } from "../db";
import {
  createEntityHelpers,
  type InvitationHelperConfig,
  type Entity,
} from "@sudobility/entity_service";

const sharedConfig: InvitationHelperConfig = {
  db: db as any,
  entitiesTable: entities,
  membersTable: entityMembers,
  invitationsTable: entityInvitations,
  usersTable: users,
};

export const entityHelpers = createEntityHelpers(sharedConfig);

// =============================================================================
// Permission Result Type
// =============================================================================

interface PermissionSuccess {
  entity: Entity;
  error?: never;
  errorCode?: never;
}

interface PermissionFailure {
  entity?: never;
  error: string;
  errorCode: string;
}

export type EntityPermissionResult = PermissionSuccess | PermissionFailure;

// =============================================================================
// Shared Permission Helper
// =============================================================================

export async function getEntityWithPermission(
  entitySlug: string,
  userId: string,
  requireEdit = false
): Promise<EntityPermissionResult> {
  const entity = await entityHelpers.entity.getEntityBySlug(entitySlug);
  if (!entity) {
    return { error: "Entity not found", errorCode: "ENTITY_NOT_FOUND" };
  }

  if (requireEdit) {
    const canEdit = await entityHelpers.permissions.canCreateProjects(
      entity.id,
      userId
    );
    if (!canEdit) {
      return {
        error: "Insufficient permissions",
        errorCode: "INSUFFICIENT_PERMISSIONS",
      };
    }
  } else {
    const canView = await entityHelpers.permissions.canViewEntity(
      entity.id,
      userId
    );
    if (!canView) {
      return { error: "Access denied", errorCode: "ACCESS_DENIED" };
    }
  }

  return { entity };
}

export function getPermissionErrorStatus(errorCode: string): 400 | 403 | 404 {
  switch (errorCode) {
    case "ENTITY_NOT_FOUND":
      return 404;
    case "ACCESS_DENIED":
    case "INSUFFICIENT_PERMISSIONS":
      return 403;
    default:
      return 400;
  }
}
