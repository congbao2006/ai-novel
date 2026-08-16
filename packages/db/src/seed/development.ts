import type { DatabaseClient } from "../client.js";
import {
  storyCharacters,
  storyFactions,
  stories,
  users,
  type NewStory,
  type NewStoryCharacter,
  type NewStoryFaction,
  type NewUser
} from "../schema/index.js";

export const developmentSeedUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "demo@ai-novel.local",
  displayName: "Demo Player",
  passwordHash:
    "$argon2id$v=19$m=65536,p=4,t=3$sKlEDlpRvg4o/yKt2yLW/Q$Ia5e+f2bROz7V6xkudODUa0VDa7mJ7+Xj5JHNe8FCU0"
} satisfies NewUser;

export const developmentSeedStories = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    title: "Đại Việt 1288",
    slug: "dai-viet-1288",
    description: "Một chuyến nhập vai giữa khói lửa sông Bạch Đằng.",
    genre: "historical-fantasy",
    status: "published",
    worldPrompt: "Đại Việt cuối thế kỷ 13, căng thẳng trước trận thủy chiến.",
    openingPrompt: "Trống canh vang bên bến sông, và tin báo quân thù đã đến gần.",
    settings: {
      initialLocation: "Bến sông Vân Đồn",
      initialWorldTime: "Đêm trước trận thủy chiến"
    },
    createdByUserId: developmentSeedUser.id
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    title: "Ngày Thứ Nhất",
    slug: "ngay-thu-nhat",
    description: "Thành phố tỉnh dậy sau một hiện tượng không ai giải thích được.",
    genre: "survival-mystery",
    status: "published",
    worldPrompt: "Một đô thị hiện đại bị chia cắt sau biến cố siêu nhiên.",
    openingPrompt: "Điện tắt. Sóng mất. Ngoài cửa sổ, bầu trời có hai mặt trời.",
    settings: {
      initialLocation: "Trạm điện Bắc Quận",
      initialWorldTime: "06:12 ngày thứ nhất"
    },
    createdByUserId: developmentSeedUser.id
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    title: "Căn Phòng Khóa Kín",
    slug: "can-phong-khoa-kin",
    description: "Một bí ẩn tâm lý diễn ra trong căn phòng không có lối ra rõ ràng.",
    genre: "locked-room-mystery",
    status: "draft",
    worldPrompt: "Không gian hẹp, manh mối ít, mọi chi tiết đều có thể quan trọng.",
    openingPrompt: "Bạn tỉnh dậy trên nền gỗ lạnh, trước mặt là một chiếc bàn trống.",
    settings: {
      initialLocation: "Căn phòng khóa kín",
      initialWorldTime: "Không rõ"
    },
    createdByUserId: developmentSeedUser.id
  }
] satisfies NewStory[];

export const developmentSeedStoryCharacters = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    storyId: "00000000-0000-4000-8000-000000000101",
    characterType: "playable",
    name: "Trần Minh",
    description: "Một liên lạc viên trẻ quen đường sông nước.",
    personality: "Nhanh trí, trung thành, hơi liều.",
    background: "Lớn lên ở vùng ven sông, từng đưa tin cho doanh trại địa phương.",
    initialStats: { courage: 7, wit: 6, endurance: 5 }
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    storyId: "00000000-0000-4000-8000-000000000101",
    characterType: "npc",
    name: "Lê An",
    description: "Một thầy thuốc đi theo đoàn quân.",
    personality: "Điềm đạm, quan sát kỹ, ghét lãng phí sinh mạng.",
    background: "Học nghề thuốc từ cha, mang theo sổ ghi chép thảo dược.",
    initialStats: { medicine: 8, empathy: 7, courage: 4 },
    goals: [{ key: "protect_wounded", status: "active", progress: 20 }],
    secrets: { doubt: "Lo sợ một người trong doanh trại đang bán tin." },
    initialLocation: "Bến sông Vân Đồn"
  },
  {
    id: "00000000-0000-4000-8000-000000000203",
    storyId: "00000000-0000-4000-8000-000000000102",
    characterType: "playable",
    name: "Mai Khuê",
    description: "Một kỹ sư hạ tầng đang mắc kẹt trong thành phố.",
    personality: "Thực tế, quyết đoán, dễ mất kiên nhẫn với lời đồn.",
    background: "Biết bản đồ đường hầm kỹ thuật và các trạm điện cũ.",
    initialStats: { engineering: 8, stamina: 5, negotiation: 4 }
  },
  {
    id: "00000000-0000-4000-8000-000000000204",
    storyId: "00000000-0000-4000-8000-000000000102",
    characterType: "npc",
    name: "Nam Phong",
    description: "Một phóng viên tự do luôn mang theo máy ghi âm.",
    personality: "Tò mò, linh hoạt, không dễ tin ai.",
    background: "Đang điều tra một chuỗi tin mất tích trước ngày biến cố.",
    initialStats: { investigation: 7, agility: 6, resolve: 5 },
    goals: [{ key: "document_truth", status: "active", progress: 10 }],
    secrets: { lead: "Đã nghe tin về một hầm kỹ thuật bị niêm phong." },
    initialLocation: "Trạm điện Bắc Quận"
  },
  {
    id: "00000000-0000-4000-8000-000000000205",
    storyId: "00000000-0000-4000-8000-000000000103",
    characterType: "playable",
    name: "An Nhiên",
    description: "Một người chơi tỉnh dậy với trí nhớ bị đứt đoạn.",
    personality: "Cẩn trọng, nhạy với chi tiết, ít nói.",
    background: "Chỉ nhớ một câu nhắn: đừng tin chiếc đồng hồ.",
    initialStats: { perception: 8, composure: 6, strength: 3 }
  },
  {
    id: "00000000-0000-4000-8000-000000000206",
    storyId: "00000000-0000-4000-8000-000000000103",
    characterType: "npc",
    name: "Hoàng Vũ",
    description: "Một người lạ tỉnh dậy phía sau tấm bình phong.",
    personality: "Lịch sự, sắc bén, có vẻ đang che giấu điều gì đó.",
    background: "Mang theo chìa khóa không khớp với bất kỳ ổ khóa nào trong phòng.",
    initialStats: { logic: 8, deception: 6, empathy: 4 },
    goals: [{ key: "hide_origin", status: "active", progress: 35 }],
    secrets: { keyOrigin: "Biết chiếc chìa khóa không thuộc căn phòng này." },
    initialLocation: "Sau tấm bình phong"
  }
] satisfies NewStoryCharacter[];

export const developmentSeedStoryFactions = [
  {
    id: "00000000-0000-4000-8000-000000000301",
    storyId: "00000000-0000-4000-8000-000000000101",
    factionKey: "tran_camp",
    name: "Doanh trại Trần",
    description: "Lực lượng phòng thủ ven sông đang chuẩn bị nghênh chiến.",
    initialStatus: "active",
    initialInfluence: 60,
    resources: { wealth: 35, manpower: 70, supplies: 55, politicalPower: 65 },
    goals: [{ key: "hold_river", status: "active", progress: 45 }],
    state: {}
  },
  {
    id: "00000000-0000-4000-8000-000000000302",
    storyId: "00000000-0000-4000-8000-000000000102",
    factionKey: "district_watch",
    name: "Nhóm Canh Gác Khu Bắc",
    description: "Cư dân tự tổ chức để giữ an toàn sau biến cố.",
    initialStatus: "active",
    initialInfluence: 45,
    resources: { wealth: 20, manpower: 35, supplies: 30, politicalPower: 25 },
    goals: [{ key: "secure_block", status: "active", progress: 25 }],
    state: {}
  },
  {
    id: "00000000-0000-4000-8000-000000000303",
    storyId: "00000000-0000-4000-8000-000000000103",
    factionKey: "locked_room_truth",
    name: "Sự Thật Trong Phòng",
    description: "Một thế lực trừu tượng đại diện cho áp lực của bí mật.",
    initialStatus: "hidden",
    initialInfluence: 30,
    resources: { wealth: 0, manpower: 0, supplies: 0, politicalPower: 45 },
    goals: [{ key: "remain_hidden", status: "active", progress: 60 }],
    state: {}
  }
] satisfies NewStoryFaction[];

export const developmentSeedData = {
  user: developmentSeedUser,
  stories: developmentSeedStories,
  storyCharacters: developmentSeedStoryCharacters,
  storyFactions: developmentSeedStoryFactions
} as const;

export async function seedDevelopmentDatabase(db: DatabaseClient): Promise<void> {
  await db
    .insert(users)
    .values(developmentSeedUser)
    .onConflictDoNothing({ target: users.email });

  await db
    .insert(stories)
    .values(developmentSeedStories)
    .onConflictDoNothing({ target: stories.slug });

  await db
    .insert(storyCharacters)
    .values(developmentSeedStoryCharacters)
    .onConflictDoNothing({ target: storyCharacters.id });

  await db
    .insert(storyFactions)
    .values(developmentSeedStoryFactions)
    .onConflictDoNothing({ target: storyFactions.id });
}
