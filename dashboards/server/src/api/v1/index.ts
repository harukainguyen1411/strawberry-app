import { Router } from "express";
import { runsCreateRouter } from "./runs.create.js";

export const v1Router = Router();

v1Router.use("/runs", runsCreateRouter);
