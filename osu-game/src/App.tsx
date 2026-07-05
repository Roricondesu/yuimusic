import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { TopNav } from "@/components/layout/TopNav";
import { Background } from "@/components/layout/Background";
import Home from "@/pages/Home";
import Search from "@/pages/Search";
import BeatmapSetDetail from "@/pages/BeatmapSetDetail";
import Game from "@/pages/Game";
import Settings from "@/pages/Settings";

export default function App() {
  return (
    <Router>
      <Background />
      <TopNav />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/search" element={<Search />} />
        <Route path="/set/:setId" element={<BeatmapSetDetail />} />
        <Route path="/game/:setId/:mode/:diff" element={<Game />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </Router>
  );
}
