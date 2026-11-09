import { serializable } from "serializr";

export class ApiErrorModel {
  @serializable
  message = "";
}
