import type { Metadata, Viewport } from "next";
// 제목·버튼 글자: Wanted Sans Variable (npm 패키지, OFL. 글자 범위별로 필요한 조각만 받는 split 버전)
import "wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.css";
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
  themeColor: "#F4F3EF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
