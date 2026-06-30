import { expect, test } from "vitest";
import { ENGINE_VERSION } from "../src/index.js";
test("engine package loads", () => { expect(ENGINE_VERSION).toBe("1.0.0"); });
