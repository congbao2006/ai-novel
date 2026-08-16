import type { RepositoryContext, StoryRecord } from "@ai-novel/db";

const defaultFactionTemplates = [
  {
    factionKey: "city_guard",
    name: "Đội Tuần Thành",
    description: "Lực lượng giữ trật tự tại các khu dân cư và cổng thành.",
    influence: 55,
    resources: {
      wealth: 40,
      manpower: 60,
      supplies: 50,
      politicalPower: 50
    },
    goals: [
      {
        key: "keep_order",
        status: "active",
        progress: 40
      }
    ]
  },
  {
    factionKey: "river_guild",
    name: "Bang Sông Nước",
    description: "Mạng lưới thương nhân, lái đò và người đưa tin ven sông.",
    influence: 50,
    resources: {
      wealth: 55,
      manpower: 35,
      supplies: 60,
      politicalPower: 35
    },
    goals: [
      {
        key: "secure_routes",
        status: "active",
        progress: 35
      }
    ]
  },
  {
    factionKey: "shadow_court",
    name: "Mật Hội Bóng Tối",
    description: "Một mạng lưới bí mật theo đuổi lợi ích riêng trong bóng tối.",
    influence: 45,
    resources: {
      wealth: 45,
      manpower: 30,
      supplies: 35,
      politicalPower: 55
    },
    goals: [
      {
        key: "expand_influence",
        status: "active",
        progress: 25
      }
    ]
  }
] as const;

export class FactionInitializationService {
  async initializeForSession(input: {
    readonly context: RepositoryContext;
    readonly sessionId: string;
    readonly story: StoryRecord;
  }): Promise<void> {
    const existing = await input.context.repositories.factions.listBySession(
      input.sessionId
    );

    if (existing.length > 0) {
      return;
    }

    for (const template of defaultFactionTemplates) {
      await input.context.repositories.factions.create({
        sessionId: input.sessionId,
        factionKey: `${input.story.slug}.${template.factionKey}`,
        name: template.name,
        description: template.description,
        status: "active",
        influence: template.influence,
        resources: template.resources,
        goals: [...template.goals],
        state: {
          source: "default_seed",
          storySlug: input.story.slug
        }
      });
    }

    await input.context.repositories.worldSimulationStates.createInitial({
      sessionId: input.sessionId,
      lastTickTurn: 0
    });
  }
}
