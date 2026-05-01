import assert from "node:assert/strict";
import test from "node:test";
import { getPagination, paginateItems } from "../src/utils/pagination";

test("parses pagination query with safe defaults and max limit", () => {
  assert.deepEqual(getPagination({}), { page: 1, limit: 12 });
  assert.deepEqual(getPagination({ page: "3", limit: "80" }), { page: 3, limit: 50 });
  assert.deepEqual(getPagination({ page: "-1", limit: "0" }), { page: 1, limit: 12 });
});

test("slices items and clamps pages beyond the last page", () => {
  const result = paginateItems(["a", "b", "c"], 5, 2);

  assert.deepEqual(result.items, ["c"]);
  assert.deepEqual(result.meta, {
    page: 2,
    limit: 2,
    total: 3,
    totalPages: 2,
  });
});
