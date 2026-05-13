import type { RouteType } from "@ccv/server/hono/routes";
import { hc } from "hono/client";

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export class HttpError extends Error {
  public readonly status: number;
  public readonly statusText: string;

  constructor(status: number, statusText: string) {
    super(`HttpError: ${status} ${statusText}`);
    this.status = status;
    this.statusText = statusText;
  }
}

const customFetch: Fetch = async (input, init) => {
  const response = await fetch(input, init);
  if (!response.ok) {
    console.error(response);
    throw new HttpError(response.status, response.statusText);
  }
  return response;
};

export const honoClient = hc<RouteType>("/", {
  fetch: customFetch,
});
