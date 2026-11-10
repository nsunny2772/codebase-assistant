import { Route, Routes } from "react-router-dom";

import Home from "@src/views/Home";
import RepositoryWorkspace from "@src/views/Repository/RepositoryWorkspace";
import NotFound from "@src/shared/components/NotFound";
import { RoutePath } from "@src/routes/routePaths";
import Explore from "@src/views/Explore";

export const AppRoutes = () => (
  <Routes>
    <Route path={RoutePath.HOME} element={<Home />}>
      <Route index element={<RepositoryWorkspace />} />
      <Route path={RoutePath.REPOSITORIES} element={<RepositoryWorkspace />} />
      <Route path={RoutePath.REPOSITORY} element={<RepositoryWorkspace />} />
      <Route path={RoutePath.EXPLORE} element={<Explore />} />
    </Route>
    <Route path={RoutePath.NOT_FOUND} element={<NotFound />} />
  </Routes>
);
