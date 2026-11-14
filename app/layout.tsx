import type { Metadata, Viewport } from "next";
// 본문 폰트: Pretendard (npm 패키지로 직접 넣음. 한국어 글리프를 쓰는 만큼만 나눠 받는 dynamic subset)
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
// 제목 폰트: Wanted Sans Variable (npm 패키지, OFL. 글자 범위별로 나눠 필요한 조각만 받는 split 버전)
import "wanted-sans/fonts/webfonts/variable/split/WantedSansVariable.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudyTok · 숏폼으로 공부하기",
  description: "강의자료 PDF를 AI가 숏폼 학습 카드와 즉석 퀴즈로 바꿔 주는 세로 스크롤 학습 웹앱",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#4F72FF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
