import { Hono } from "hono";
import { firebaseAuthMiddleware } from "../middleware/firebaseAuth";
import usersRouter from "./users";
import historiesRouter from "./histories";
import historiesTotalRouter from "./historiesTotal";
import entitiesRouter from "./entities";
import invitationsRouter from "./invitations";

const routes = new Hono();

// Public routes (no auth required)
routes.route("/histories", historiesTotalRouter);

// Auth-required routes
const authRoutes = new Hono();
authRoutes.use("*", firebaseAuthMiddleware);
authRoutes.route("/entities", entitiesRouter);
authRoutes.route("/entities/:entitySlug/histories", historiesRouter);
authRoutes.route("/invitations", invitationsRouter);
authRoutes.route("/users/:userId", usersRouter);
routes.route("/", authRoutes);

export default routes;
