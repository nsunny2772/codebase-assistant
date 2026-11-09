import { Outlet } from "react-router-dom";

import { Navbar } from "@src/shared/components/Navbar";

import styles from "./home.module.scss";

const Home = () => (
  <div className={styles.home}>
    <Navbar />
    <Outlet />
  </div>
);
export default Home;
