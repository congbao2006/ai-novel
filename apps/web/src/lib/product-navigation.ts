export type ProductNavLink = {
  readonly href: string;
  readonly label: string;
  readonly disabled?: boolean;
};

export type ProductNavGroup = {
  readonly title: string;
  readonly links: readonly ProductNavLink[];
};

export const productNavGroups: readonly ProductNavGroup[] = [
  {
    title: "Discover",
    links: [
      { href: "/", label: "Home" },
      { href: "/stories", label: "Stories" },
      { href: "/sessions", label: "My Sessions" }
    ]
  },
  {
    title: "Create",
    links: [
      { href: "/author", label: "Creator Studio" },
      { href: "/author", label: "My Stories" }
    ]
  },
  {
    title: "Library",
    links: [
      { href: "#", label: "Saved", disabled: true },
      { href: "#", label: "Read", disabled: true },
      { href: "#", label: "Listen", disabled: true },
      { href: "#", label: "Community", disabled: true }
    ]
  }
] as const;

export const authorEditorSections = [
  { id: "overview", label: "Overview" },
  { id: "world", label: "World" },
  { id: "characters", label: "Characters" },
  { id: "abilities", label: "Abilities" },
  { id: "factions", label: "Factions" },
  { id: "versions", label: "Versions" },
  { id: "publish", label: "Publish" }
] as const;
