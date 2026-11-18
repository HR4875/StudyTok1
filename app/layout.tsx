import type { Metadata, Viewport } from "next";
// 제목·버튼·모션 글자: Jua (@fontsource, 'Jua' 이름 그대로 써야 모션 렌더러가 찾는다)
import "@fontsource/jua";
// 본문: Pretendard (npm 패키지, 쓰는 글자만 받는 dynamic subset)
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyTok · 공부를 숏폼으로",
  description: "강의자료·자격증 PDF를 올리면 개념마다 숏폼 카드와 퀴즈로 바꿔 주는 학습 피드",
  applicationName: "StudyTok",
  appleWebApp: { capable: true, title: "StudyTok", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#4B6BFB",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
