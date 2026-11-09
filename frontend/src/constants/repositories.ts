import type { SupportedRepository } from "@src/types/supportedRepository";

export const examples = [
  {
    name: "MERN CRUD application",
    profile: "MERN",
    url: "https://github.com/mongodb-developer/mern-stack-example",
    description: "React client, Express API and MongoDB data access.",
  },
  {
    name: "Flask web application",
    profile: "Python",
    url: "https://github.com/miguelgrinberg/flasky",
    description: "Python modules, Flask views, models and application setup.",
  },
  {
    name: "React + FastAPI template",
    profile: "Python + React",
    url: "https://github.com/fastapi/full-stack-fastapi-template",
    description:
      "A larger full-stack example. Indexing may take longer or reach free-tier limits.",
  },
] satisfies readonly SupportedRepository[];
