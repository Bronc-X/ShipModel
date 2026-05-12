import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { categories, defaultInputForSubtype, firstSubtype, stylesByCategory } from "../src/toybox/catalog.ts";

describe("toybox catalog defaults", () => {
  it("provides different default prompts for category and subtype changes", () => {
    const raceCar = defaultInputForSubtype("vehicle", "race-car");
    const offRoad = defaultInputForSubtype("vehicle", "off-road");
    const aircraft = defaultInputForSubtype("aircraft", firstSubtype("aircraft"));

    assert.notEqual(raceCar.description, offRoad.description);
    assert.notEqual(raceCar.description, aircraft.description);
    assert.match(raceCar.description, /赛车|赛道|轮拱/);
    assert.match(offRoad.description, /越野|底盘|胎纹|防护/);
    assert.match(aircraft.description, /机翼|机身|航|翼/);
  });

  it("uses category-specific style options and defaults", () => {
    const vehicle = defaultInputForSubtype("vehicle", "race-car");
    const aircraft = defaultInputForSubtype("aircraft", firstSubtype("aircraft"));
    const ship = defaultInputForSubtype("ship", firstSubtype("ship"));

    assert.notDeepEqual(stylesByCategory.vehicle, stylesByCategory.aircraft);
    assert.notDeepEqual(stylesByCategory.vehicle, stylesByCategory.ship);
    assert.notDeepEqual(stylesByCategory.aircraft, stylesByCategory.ship);
    assert.equal(vehicle.style, stylesByCategory.vehicle[0]);
    assert.equal(aircraft.style, stylesByCategory.aircraft[0]);
    assert.equal(ship.style, stylesByCategory.ship[0]);
  });

  it("adds passenger airliner as an aircraft subtype with a dedicated default prompt", () => {
    const aircraftCategory = categories.find((category) => category.id === "aircraft");
    const airliner = defaultInputForSubtype("aircraft", "airliner");

    assert.ok(aircraftCategory?.subtypes.some((subtype) => subtype.id === "airliner" && subtype.name === "客机"));
    assert.equal(airliner.subtype, "airliner");
    assert.match(airliner.description, /客机|宽体|机舱|舷窗|发动机/);
  });
});
