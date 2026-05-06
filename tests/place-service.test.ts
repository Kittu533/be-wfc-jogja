import assert from "node:assert/strict";
import test from "node:test";
import { getCafeSort } from "../src/services/place.service";

test("defaults public cafe sorting to highest rating first", () => {
  assert.equal(getCafeSort({}), "rating");
  assert.equal(getCafeSort({ sort: "" }), "rating");
  assert.equal(getCafeSort({ sort: "recommended" }), "recommended");
});
