// 이 화면의 스타일은 모두 .film 아래에만 걸린다 (앱의 다른 화면에는 닿지 않는다)
import "./film.css";
import "./player.css";
import { filmMetadata, filmViewport } from "./meta";

export const metadata = filmMetadata;
export const viewport = filmViewport;

export default function FilmLayout({ children }: { children: React.ReactNode }) {
  return children;
}
