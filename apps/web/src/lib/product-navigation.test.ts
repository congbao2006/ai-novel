import { describe, expect, it } from "vitest";
import { authorEditorSections, productNavGroups } from "./product-navigation";

describe("product navigation", () => {
  it("keeps existing playable features reachable from the global shell", () => {
    const labels = productNavGroups.flatMap((group) =>
      group.links.map((link) => link.label)
    );

    expect(labels).toEqual(
      expect.arrayContaining([
        "Home",
        "Stories",
        "My Sessions",
        "Creator Studio",
        "My Stories"
      ])
    );
  });

  it("marks future product areas as coming soon instead of fake routes", () => {
    const futureLinks = productNavGroups
      .flatMap((group) => group.links)
      .filter((link) => ["Read", "Listen", "Community"].includes(link.label));

    expect(futureLinks).toHaveLength(3);
    expect(futureLinks.every((link) => link.disabled && link.href === "#")).toBe(
      true
    );
  });

  it("breaks the author editor into all required management sections", () => {
    expect(authorEditorSections.map((section) => section.label)).toEqual([
      "Overview",
      "World",
      "Characters",
      "Abilities",
      "Factions",
      "Versions",
      "Publish"
    ]);
  });
});
