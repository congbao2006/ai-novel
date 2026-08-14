import type { DatabaseClient } from "../client.js";
import {
  storyCharacters,
  stories,
  users,
  type NewStory,
  type NewStoryCharacter,
  type NewUser
} from "../schema/index.js";

export const developmentSeedUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "demo@ai-novel.local",
  displayName: "Demo Player"
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
    createdByUserId: developmentSeedUser.id
  }
] satisfies NewStory[];

export const developmentSeedStoryCharacters = [
  {
    id: "00000000-0000-4000-8000-000000000201",
    storyId: "00000000-0000-4000-8000-000000000101",
    name: "Trần Minh",
    description: "Một liên lạc viên trẻ quen đường sông nước.",
    personality: "Nhanh trí, trung thành, hơi liều.",
    background: "Lớn lên ở vùng ven sông, từng đưa tin cho doanh trại địa phương.",
    initialStats: { courage: 7, wit: 6, endurance: 5 }
  },
  {
    id: "00000000-0000-4000-8000-000000000202",
    storyId: "00000000-0000-4000-8000-000000000101",
    name: "Lê An",
    description: "Một thầy thuốc đi theo đoàn quân.",
    personality: "Điềm đạm, quan sát kỹ, ghét lãng phí sinh mạng.",
    background: "Học nghề thuốc từ cha, mang theo sổ ghi chép thảo dược.",
    initialStats: { medicine: 8, empathy: 7, courage: 4 }
  },
  {
    id: "00000000-0000-4000-8000-000000000203",
    storyId: "00000000-0000-4000-8000-000000000102",
    name: "Mai Khuê",
    description: "Một kỹ sư hạ tầng đang mắc kẹt trong thành phố.",
    personality: "Thực tế, quyết đoán, dễ mất kiên nhẫn với lời đồn.",
    background: "Biết bản đồ đường hầm kỹ thuật và các trạm điện cũ.",
    initialStats: { engineering: 8, stamina: 5, negotiation: 4 }
  },
  {
    id: "00000000-0000-4000-8000-000000000204",
    storyId: "00000000-0000-4000-8000-000000000102",
    name: "Nam Phong",
    description: "Một phóng viên tự do luôn mang theo máy ghi âm.",
    personality: "Tò mò, linh hoạt, không dễ tin ai.",
    background: "Đang điều tra một chuỗi tin mất tích trước ngày biến cố.",
    initialStats: { investigation: 7, agility: 6, resolve: 5 }
  },
  {
    id: "00000000-0000-4000-8000-000000000205",
    storyId: "00000000-0000-4000-8000-000000000103",
    name: "An Nhiên",
    description: "Một người chơi tỉnh dậy với trí nhớ bị đứt đoạn.",
    personality: "Cẩn trọng, nhạy với chi tiết, ít nói.",
    background: "Chỉ nhớ một câu nhắn: đừng tin chiếc đồng hồ.",
    initialStats: { perception: 8, composure: 6, strength: 3 }
  },
  {
    id: "00000000-0000-4000-8000-000000000206",
    storyId: "00000000-0000-4000-8000-000000000103",
    name: "Hoàng Vũ",
    description: "Một người lạ tỉnh dậy phía sau tấm bình phong.",
    personality: "Lịch sự, sắc bén, có vẻ đang che giấu điều gì đó.",
    background: "Mang theo chìa khóa không khớp với bất kỳ ổ khóa nào trong phòng.",
    initialStats: { logic: 8, deception: 6, empathy: 4 }
  }
] satisfies NewStoryCharacter[];

export const developmentSeedData = {
  user: developmentSeedUser,
  stories: developmentSeedStories,
  storyCharacters: developmentSeedStoryCharacters
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
}
