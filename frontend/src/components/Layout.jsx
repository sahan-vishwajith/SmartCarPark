import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";
import PrebookProvider from "./Prebook/PrebookProvider";

export default function Layout() {
  return (
    <div className="page">
      {/* Background layers */}
      <div className="bgRadial" />
      <div className="bgNoise" />

      {/* PrebookProvider must wrap Navbar + pages (because Navbar calls usePrebook) */}
      <PrebookProvider>
        <Navbar />
        <Outlet />
      </PrebookProvider>
    </div>
  );
}