// 첫 주소(/)는 소비자가 보는 모션 쇼츠 앱이다 (/film과 같은 화면). 앞서 쓰던 카드 피드 앱은 /classic 으로 옮겼다.
import "./film/film.css";
import "./film/player.css";
import FilmPage from "./film/page";
import { filmMetadata, filmViewport } from "./film/meta";

export const metadata = filmMetadata;
export const viewport = filmViewport;

export default FilmPage;
