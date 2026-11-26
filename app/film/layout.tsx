import type { Metadata, Viewport } from "next";
// 이 화면의 스타일은 모두 .film 아래에만 걸린다 (앱의 다른 화면에는 닿지 않는다)
import "./film.css";
import "./player.css";

export const metadata: Metadata = {
  title: "StudyTok · 어려운 전공도 60초 그림으로",
  description: "전공책이나 자격증 교재를 올리면 한 편에 한 가지씩, 그림이 움직이며 설명하는 모션 쇼츠로 바꿔 줍니다",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F4F3EF" },
    { media: "(prefers-color-scheme: dark)", color: "#0F1117" },
  ],
};

export default function FilmLayout({ children }: { children: React.ReactNode }) {
  return children;
}
