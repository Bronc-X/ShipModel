import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseRoute, routePaths } from "../src/toybox/routes";

describe("ToyBox route helpers", () => {
  it("keeps only useful global and project utility routes", () => {
    assert.equal(routePaths.files, "/files");
    assert.equal(routePaths.settings, "/settings");
    assert.equal(routePaths.help, "/help");
    assert.equal(routePaths.profile, "/profile");
    assert.equal(routePaths.history, "/history");
    assert.equal(routePaths.storage, "/storage");
    assert.equal(routePaths.invite, "/invite");
  });

  it("parses utility routes used by header buttons", () => {
    assert.equal(parseRoute("/files").name, "files");
    assert.equal(parseRoute("/settings").name, "settings");
    assert.equal(parseRoute("/help").name, "help");
    assert.equal(parseRoute("/profile").name, "profile");
    assert.equal(parseRoute("/edit").name, "configure");
    assert.equal(parseRoute("/view").name, "configure");
    assert.equal(parseRoute("/window").name, "configure");
  });

  it("parses project sidebar utility routes", () => {
    assert.equal(parseRoute("/history").name, "history");
    assert.equal(parseRoute("/storage").name, "storage");
    assert.equal(parseRoute("/invite").name, "invite");
  });
});
