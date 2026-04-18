// xfail — full emulator assertions land when @firebase/rules-unit-testing is wired.
// Upgrade to real emulator assertions on B1 follow-up PR.
import { describe, it, expect } from "vitest";

describe("firestore security rules", () => {
  it.fails(
    "anonymous client read of runs/ collection is denied",
    async () => {
      // Requires Firebase emulator + @firebase/rules-unit-testing — not wired yet.
      const { initializeTestEnvironment } = await import(
        "@firebase/rules-unit-testing"
      );
      const env = await initializeTestEnvironment({ projectId: "demo-test" });
      const db = env.unauthenticatedContext().firestore();
      await expect(db.collection("runs").get()).rejects.toBeDefined();
    }
  );

  it.fails(
    "anonymous client write to runs/ collection is denied",
    async () => {
      const { initializeTestEnvironment } = await import(
        "@firebase/rules-unit-testing"
      );
      const env = await initializeTestEnvironment({ projectId: "demo-test" });
      const db = env.unauthenticatedContext().firestore();
      await expect(
        db.collection("runs").add({ type: "unit" })
      ).rejects.toBeDefined();
    }
  );
});
