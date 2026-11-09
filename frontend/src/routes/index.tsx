import { Route, Routes } from "react-router-dom";

import Home from "@src/views/Home";
import RepositoryWorkspace from "@src/views/Repository/RepositoryWorkspace";
import NotFound from "@src/shared/components/NotFound";
import { RoutePath } from "@src/routes/routePaths";

export const AppRoutes = () => (
  <Routes>
    <Route path={RoutePath.HOME} element={<Home />}>
      <Route index element={<RepositoryWorkspace />} />
      <Route path={RoutePath.REPOSITORIES} element={<RepositoryWorkspace />} />
      <Route path={RoutePath.REPOSITORY} element={<RepositoryWorkspace />} />
    </Route>
    <Route path={RoutePath.NOT_FOUND} element={<NotFound />} />
  </Routes>
);
