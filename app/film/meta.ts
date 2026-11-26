import type { Metadata, Viewport } from "next";

// 모션 쇼츠 앱(/와 /film)이 같이 쓰는 머리 정보
export const filmMetadata: Metadata = {
  title: "StudyTok · 자료만 올리면 숏폼 강의 완성",
  description: "전공책이나 자격증 교재를 올리면 한 편에 한 가지씩, 그림이 움직이며 설명하는 60초 모션 쇼츠로 바꿔 줍니다",
};

export const filmViewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 앱의 다른 화면은 확대를 막아 두었지만, 여기서는 글자를 키워 볼 수 있게 둔다
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  // 밝은 화면 하나만 쓴다
  themeColor: "#F4F3EF",
  colorScheme: "light",
};
