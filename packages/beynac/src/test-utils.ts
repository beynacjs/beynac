import { mock } from "bun:test";
import { Controller } from "./core/Controller";

type MockControllerArgs = {
  response?: Response;
  responseText?: string;
};

export const mockController = ({
  response,
  responseText,
}: MockControllerArgs = {}): Controller => ({
  handle: mock(() => {
    if (response) return response;
    if (responseText != null) {
      return new Response(responseText);
    }
    return new Response();
  }),
});
