import { describe, it, expect } from "vitest";
import { extractStrawberryMeta } from "../issue/parse.js";

const SAMPLE_META_BLOCK = `<!-- strawberry-meta
discord_channel_id: 1234567890
discord_message_id: 9876543210
discord_user_id: 1111111111
discord_guild_id: 2222222222
origin: discord-relay
-->`;

describe("extractStrawberryMeta", () => {
  it("returns null when no meta block is present", () => {
    expect(extractStrawberryMeta("No metadata here.")).toBeNull();
  });

  it("returns null on empty string", () => {
    expect(extractStrawberryMeta("")).toBeNull();
  });

  it("parses a well-formed meta block", () => {
    const body = `Some issue body.\n\n${SAMPLE_META_BLOCK}`;
    const result = extractStrawberryMeta(body);
    expect(result).not.toBeNull();
    expect(result!.discord_channel_id).toBe("1234567890");
    expect(result!.discord_message_id).toBe("9876543210");
    expect(result!.discord_user_id).toBe("1111111111");
    expect(result!.discord_guild_id).toBe("2222222222");
    expect(result!.origin).toBe("discord-relay");
  });

  it("parses a meta block that appears mid-body", () => {
    const body = `First paragraph.\n\n${SAMPLE_META_BLOCK}\n\nTrailing content.`;
    const result = extractStrawberryMeta(body);
    expect(result).not.toBeNull();
    expect(result!.discord_channel_id).toBe("1234567890");
  });

  it("returns null when the block is malformed (no closing -->)", () => {
    const body = "<!-- strawberry-meta\nfoo: bar\n";
    expect(extractStrawberryMeta(body)).toBeNull();
  });

  it("ignores lines without a colon separator", () => {
    const body = `<!-- strawberry-meta\nno_colon_line\nkey: value\n-->`;
    const result = extractStrawberryMeta(body);
    expect(result).not.toBeNull();
    expect(result!.key).toBe("value");
    expect(Object.keys(result!)).not.toContain("no_colon_line");
  });

  it("handles values that contain colons", () => {
    const body = `<!-- strawberry-meta\nurl: https://example.com/path\n-->`;
    const result = extractStrawberryMeta(body);
    expect(result).not.toBeNull();
    expect(result!.url).toBe("https://example.com/path");
  });
});
