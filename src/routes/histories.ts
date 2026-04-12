import { Hono } from "hono";
import { eq, and, desc, asc } from "drizzle-orm";
import { db, histories } from "../db";
import {
  successResponse,
  errorResponse,
  type History,
  type HistoryCreateRequest,
  type HistoryUpdateRequest,
} from "@sudobility/entitystarter_types";
import { serializeHistory, isValidDatetime } from "../lib/serializers";
import {
  getEntityWithPermission,
  getPermissionErrorStatus,
} from "../lib/entity-helpers";

const historiesRouter = new Hono();

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

/**
 * GET / - List all histories for the entity.
 *
 * Mounted at /api/v1/entities/:entitySlug/histories
 */
historiesRouter.get("/", async c => {
  const entitySlug = c.req.param("entitySlug")!;
  const userId = c.get("userId");

  const result = await getEntityWithPermission(entitySlug, userId);
  if (result.error !== undefined) {
    return c.json(
      errorResponse(result.error),
      getPermissionErrorStatus(result.errorCode)
    );
  }

  const limitParam = c.req.query("limit");
  const offsetParam = c.req.query("offset");
  const orderByParam = c.req.query("orderBy");

  const limit = Math.min(
    Math.max(
      1,
      parseInt(limitParam || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT
    ),
    MAX_LIMIT
  );
  const offset = Math.max(0, parseInt(offsetParam || "0", 10) || 0);
  const orderDirection = orderByParam === "asc" ? "asc" : "desc";

  const rows = await db
    .select()
    .from(histories)
    .where(eq(histories.entity_id, result.entity.id))
    .orderBy(
      orderDirection === "asc"
        ? asc(histories.datetime)
        : desc(histories.datetime)
    )
    .limit(limit)
    .offset(offset);

  const data: History[] = rows.map(serializeHistory);
  return c.json(successResponse(data));
});

/**
 * POST / - Create a new history record for the entity.
 */
historiesRouter.post("/", async c => {
  const entitySlug = c.req.param("entitySlug")!;
  const userId = c.get("userId");

  const permResult = await getEntityWithPermission(entitySlug, userId, true);
  if (permResult.error !== undefined) {
    return c.json(
      errorResponse(permResult.error),
      getPermissionErrorStatus(permResult.errorCode)
    );
  }

  const body: HistoryCreateRequest = await c.req.json();
  const { datetime, value } = body;

  if (!datetime || value === undefined || value === null) {
    return c.json(errorResponse("datetime and value are required"), 400);
  }

  if (typeof value !== "number" || value <= 0) {
    return c.json(errorResponse("value must be a positive number"), 400);
  }

  if (typeof datetime !== "string" || !isValidDatetime(datetime)) {
    return c.json(
      errorResponse("datetime must be a valid ISO 8601 date string"),
      400
    );
  }

  const rows = await db
    .insert(histories)
    .values({
      user_id: userId,
      entity_id: permResult.entity.id,
      datetime: new Date(datetime),
      value: String(value),
    })
    .returning();

  const h = rows[0];
  return c.json(successResponse(serializeHistory(h)), 201);
});

/**
 * PUT /:historyId - Update an existing history record.
 */
historiesRouter.put("/:historyId", async c => {
  const entitySlug = c.req.param("entitySlug")!;
  const historyId = c.req.param("historyId")!;
  const userId = c.get("userId");

  const permResult = await getEntityWithPermission(entitySlug, userId, true);
  if (permResult.error !== undefined) {
    return c.json(
      errorResponse(permResult.error),
      getPermissionErrorStatus(permResult.errorCode)
    );
  }

  const body: HistoryUpdateRequest = await c.req.json();
  const updates: Record<string, unknown> = {};

  if (body.datetime !== undefined) {
    if (typeof body.datetime !== "string" || !isValidDatetime(body.datetime)) {
      return c.json(
        errorResponse("datetime must be a valid ISO 8601 date string"),
        400
      );
    }
    updates.datetime = new Date(body.datetime);
  }
  if (body.value !== undefined) {
    if (typeof body.value !== "number" || body.value <= 0) {
      return c.json(errorResponse("value must be a positive number"), 400);
    }
    updates.value = String(body.value);
  }

  if (Object.keys(updates).length === 0) {
    return c.json(errorResponse("No fields to update"), 400);
  }

  updates.updated_at = new Date();

  const rows = await db
    .update(histories)
    .set(updates)
    .where(
      and(
        eq(histories.id, historyId),
        eq(histories.entity_id, permResult.entity.id)
      )
    )
    .returning();

  if (rows.length === 0) {
    return c.json(errorResponse("History not found"), 404);
  }

  const h = rows[0];
  return c.json(successResponse(serializeHistory(h)));
});

/**
 * DELETE /:historyId - Delete a history record.
 */
historiesRouter.delete("/:historyId", async c => {
  const entitySlug = c.req.param("entitySlug")!;
  const historyId = c.req.param("historyId")!;
  const userId = c.get("userId");

  const permResult = await getEntityWithPermission(entitySlug, userId, true);
  if (permResult.error !== undefined) {
    return c.json(
      errorResponse(permResult.error),
      getPermissionErrorStatus(permResult.errorCode)
    );
  }

  const rows = await db
    .delete(histories)
    .where(
      and(
        eq(histories.id, historyId),
        eq(histories.entity_id, permResult.entity.id)
      )
    )
    .returning();

  if (rows.length === 0) {
    return c.json(errorResponse("History not found"), 404);
  }

  return c.json(successResponse<null>(null));
});

export default historiesRouter;
